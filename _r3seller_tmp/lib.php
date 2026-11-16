<?php
// R3seller · N3 Labs · Potenttial Group — núcleo del servidor
declare(strict_types=1);
date_default_timezone_set('America/Mexico_City');
const DATA_DIR = __DIR__ . '/data';
const DB_FILE = DATA_DIR . '/db.json';
const APP_URL = 'https://r3seller.potenttial.com';
const STAGES = ['Interesado', 'RFP', 'Presentada', 'Followup', 'Cierre'];
const STAGES_EN = ['Interesado' => 'Interested', 'RFP' => 'RFP', 'Presentada' => 'Presented', 'Followup' => 'Follow-up', 'Cierre' => 'Closed'];

function default_db(): array {
  return [
    'admin' => null, // se crea en la configuración inicial (primera visita)
    'allies' => [[
      'id' => 'a1', 'name' => 'geoSurge', 'code' => 'geoSurge', 'contact' => '', 'email' => '', 'user' => 'geosurge',
      'hash' => '', 'lang' => 'en', 'form' => 'https://forms.gle/83uKUXuT6h71Rkfv8',
      'report' => ['on' => false, 'day' => '1', 'hour' => '08:00', 'to' => '', 'last' => ''],
    ]],
    'sellers' => [],
    'utms' => [],
    'settings' => [
      'sheetUrl' => '', 'sheetTab' => '', 'map' => new stdClass(), 'fx' => 18.5,
      'sender' => 'geolink@potenttial.com', 'fromName' => 'R3seller · Potenttial Group',
      'smtpHost' => 'smtp.gmail.com', 'smtpPort' => 465, 'smtpUser' => 'geolink@potenttial.com', 'smtpPass' => '',
      'cronKey' => bin2hex(random_bytes(12)),
    ],
    'cache' => ['headers' => [], 'rows' => [], 'at' => 0, 'error' => ''],
    'log' => [],
  ];
}

function db_load(): array {
  if (!is_dir(DATA_DIR)) { mkdir(DATA_DIR, 0750, true); }
  if (!file_exists(DATA_DIR . '/.htaccess')) { file_put_contents(DATA_DIR . '/.htaccess', "Require all denied\nDeny from all\n"); }
  if (!file_exists(DB_FILE)) { $d = default_db(); db_save($d); return $d; }
  $d = json_decode((string)file_get_contents(DB_FILE), true);
  return is_array($d) ? $d : default_db();
}
function db_save(array $d): void {
  $tmp = DB_FILE . '.tmp';
  file_put_contents($tmp, json_encode($d, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), LOCK_EX);
  rename($tmp, DB_FILE);
}

function norm(?string $s): string {
  $s = mb_strtolower(trim((string)$s), 'UTF-8');
  $t = @iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $s);
  return $t !== false ? preg_replace('/[^a-z0-9 @._\-\/]/', '', $t) : $s;
}
function slug(string $s): string { return trim(preg_replace('/[^a-z0-9]+/', '_', norm($s)), '_'); }
function find_by(array $list, string $k, $v): ?array { foreach ($list as $x) if (($x[$k] ?? null) === $v) return $x; return null; }
function strip_secret(array $x): array { $x['hasPass'] = !empty($x['hash']); unset($x['hash']); return $x; }

/* ---------- Google Sheet ---------- */
const COLS = [
  'ally' => ['aliado', 'partner', 'ally', 'socio'], 'brand' => ['marca', 'brand', 'empresa', 'company', 'cuenta'],
  'category' => ['categ', 'category', 'industria', 'sector'], 'contact' => ['contacto', 'contact'],
  'status' => ['status', 'estatus', 'etapa', 'stage'], 'next' => ['next', 'siguiente', 'proximo'],
  'amount' => ['monto', 'amount', 'valor', 'importe'], 'currency' => ['moneda', 'currency', 'divisa'],
  'seller' => ['vendedor', 'seller', 'ejecutivo', 'owner', 'responsable'], 'notes' => ['nota', 'notes', 'coment'],
];
function sheet_csv_url(string $url, string $tab): ?string {
  if (!preg_match('~/spreadsheets/d/([\w-]+)~', $url, $m)) return null;
  $u = "https://docs.google.com/spreadsheets/d/{$m[1]}/gviz/tq?tqx=out:csv";
  if ($tab !== '') return $u . '&sheet=' . rawurlencode($tab);
  if (preg_match('~[#&?]gid=(\d+)~', $url, $g)) return $u . '&gid=' . $g[1];
  return $u;
}
function http_get(string $url): ?string {
  if (function_exists('curl_init')) {
    $c = curl_init($url);
    curl_setopt_array($c, [CURLOPT_RETURNTRANSFER => true, CURLOPT_FOLLOWLOCATION => true, CURLOPT_TIMEOUT => 20, CURLOPT_USERAGENT => 'R3seller/1.0']);
    $r = curl_exec($c); $code = curl_getinfo($c, CURLINFO_HTTP_CODE); curl_close($c);
    return ($r !== false && $code < 400) ? (string)$r : null;
  }
  $r = @file_get_contents($url); return $r === false ? null : $r;
}
function parse_csv(string $txt): array {
  $out = []; $fh = fopen('php://temp', 'r+'); fwrite($fh, $txt); rewind($fh);
  while (($row = fgetcsv($fh, 0, ',', '"', '')) !== false) { if (array_filter($row, fn($v) => trim((string)$v) !== '')) $out[] = $row; }
  fclose($fh); return $out;
}
function auto_map(array $headers, array $map): array {
  foreach (COLS as $k => $hints) {
    if (!empty($map[$k]) && in_array($map[$k], $headers, true)) continue;
    $map[$k] = '';
    foreach ($headers as $h) { foreach ($hints as $x) { if (str_contains(norm($h), $x)) { $map[$k] = $h; break 2; } } }
  }
  if ($map['contact'] === '') foreach ($headers as $h) if (str_contains(norm($h), 'nombre') && $h !== $map['brand'] && $h !== $map['seller']) { $map['contact'] = $h; break; }
  return $map;
}
function load_table(array &$db, array $t): void {
  $headers = array_map(fn($h, $i) => trim((string)$h) !== '' ? trim((string)$h) : 'Columna ' . ($i + 1), $t[0], array_keys($t[0]));
  $rows = [];
  foreach (array_slice($t, 1) as $r) { $o = []; foreach ($headers as $i => $h) $o[$h] = trim((string)($r[$i] ?? '')); $rows[] = $o; }
  $db['cache'] = ['headers' => $headers, 'rows' => $rows, 'at' => time(), 'error' => ''];
  $db['settings']['map'] = auto_map($headers, (array)$db['settings']['map']);
}
function sync_sheet(array &$db, bool $force = false): void {
  $s = $db['settings'];
  if (!$force && time() - (int)$db['cache']['at'] < 300) return;
  if (empty($s['sheetUrl'])) { $db['cache']['error'] = 'Sin Google Sheet configurado'; return; }
  $u = sheet_csv_url($s['sheetUrl'], (string)$s['sheetTab']);
  if (!$u) { $db['cache']['error'] = 'La liga no es de Google Sheets'; return; }
  $txt = http_get($u);
  if ($txt === null || stripos($txt, '<html') !== false) { $db['cache']['error'] = 'No se pudo leer el Sheet. Revisa que esté compartido como “Cualquier persona con el enlace · Lector”.'; $db['cache']['at'] = time(); return; }
  $t = parse_csv($txt);
  if (count($t) < 1) { $db['cache']['error'] = 'El Sheet está vacío'; return; }
  load_table($db, $t);
}
function stage_of(string $v): string {
  $n = str_replace([' ', '-'], '', norm($v));
  if (preg_match('/cierr|close|won|ganad/', $n)) return 'Cierre';
  if (preg_match('/follow|seguim/', $n)) return 'Followup';
  if (preg_match('/present/', $n)) return 'Presentada';
  if (preg_match('/rfp|propuesta|cotiz/', $n)) return 'RFP';
  return 'Interesado';
}
function num($v): float { $n = preg_replace('/[^0-9.\-]/', '', (string)$v); return is_numeric($n) ? (float)$n : 0.0; }
function rows_for_ally(array $db, array $a): array {
  $m = (array)$db['settings']['map']; if (empty($m['ally'])) return [];
  $g = fn($r, $k) => !empty($m[$k]) ? (string)($r[$m[$k]] ?? '') : '';
  $out = [];
  foreach ($db['cache']['rows'] as $r) {
    if (norm($g($r, 'ally')) !== norm($a['code'])) continue;
    $out[] = ['ally' => $a['name'], 'brand' => $g($r, 'brand'), 'category' => $g($r, 'category') ?: '—', 'contact' => $g($r, 'contact'),
      'status' => stage_of($g($r, 'status')), 'next' => $g($r, 'next'), 'amount' => num($g($r, 'amount')),
      'cur' => preg_match('/mxn|peso|\bmn\b/i', $g($r, 'currency')) ? 'MXN' : 'USD', 'seller' => $g($r, 'seller'), 'notes' => $g($r, 'notes')];
  }
  return $out;
}

/* ---------- permisos (el servidor decide qué filas recibe cada perfil) ---------- */
function can_view(array $sess, array $db, array $v): bool {
  $role = $sess['role'] ?? '';
  if ($role === 'admin') return in_array($v['type'], ['admin', 'ally', 'seller'], true);
  if ($role === 'ally') return $v['type'] === 'ally' && ($v['id'] ?? '') === $sess['id'];
  if ($role === 'seller') {
    $me = find_by($db['sellers'], 'id', $sess['id']); if (!$me) return false;
    if ($v['type'] === 'seller') return ($v['id'] ?? '') === $sess['id'];
    if ($v['type'] === 'ally') return in_array($v['id'] ?? '', $me['allies'], true);
  }
  return false;
}
function scope(array $db, array $v): array {
  $rows = [];
  if ($v['type'] === 'ally') { $a = find_by($db['allies'], 'id', $v['id']); return $a ? rows_for_ally($db, $a) : []; }
  if ($v['type'] === 'seller') {
    $s = find_by($db['sellers'], 'id', $v['id']); if (!$s) return [];
    foreach ($db['allies'] as $a) if (in_array($a['id'], $s['allies'], true)) foreach (rows_for_ally($db, $a) as $r) if (norm($r['seller']) === norm($s['name'])) $rows[] = $r;
    return $rows;
  }
  foreach ($db['allies'] as $a) $rows = array_merge($rows, rows_for_ally($db, $a));
  return $rows;
}
function public_seller(array $s): array { return ['name' => $s['name'], 'role' => $s['role'] ?? '', 'email' => $s['email'] ?? '', 'phone' => $s['phone'] ?? '']; }

/* ---------- correo (SMTP SSL; Google Workspace con contraseña de aplicación) ---------- */
function smtp_send(array $settings, array $to, string $subject, string $html): array {
  $to = array_values(array_filter(array_map('trim', $to), fn($e) => filter_var($e, FILTER_VALIDATE_EMAIL)));
  if (!$to) return [false, 'Sin destinatarios válidos'];
  if (empty($settings['smtpPass'])) return [false, 'Falta la contraseña de aplicación del remitente (Ajustes)'];
  $host = $settings['smtpHost'] ?: 'smtp.gmail.com'; $port = (int)($settings['smtpPort'] ?: 465);
  $fp = @stream_socket_client("ssl://$host:$port", $errno, $errstr, 20);
  if (!$fp) return [false, "No conecta a $host: $errstr"];
  stream_set_timeout($fp, 20);
  $read = function () use ($fp) { $d = ''; while (($l = fgets($fp, 515)) !== false) { $d .= $l; if (strlen($l) < 4 || $l[3] === ' ') break; } return $d; };
  $cmd = function (string $c, array $ok) use ($fp, $read) { fwrite($fp, $c . "\r\n"); $r = $read(); if (!in_array((int)substr($r, 0, 3), $ok, true)) throw new RuntimeException(trim($r)); return $r; };
  try {
    $r = $read(); if ((int)substr($r, 0, 3) !== 220) throw new RuntimeException(trim($r));
    $cmd('EHLO r3seller.potenttial.com', [250]);
    $cmd('AUTH LOGIN', [334]); $cmd(base64_encode($settings['smtpUser']), [334]); $cmd(base64_encode($settings['smtpPass']), [235]);
    $from = $settings['sender'] ?: $settings['smtpUser'];
    $cmd("MAIL FROM:<$from>", [250]);
    foreach ($to as $t) $cmd("RCPT TO:<$t>", [250, 251]);
    $cmd('DATA', [354]);
    $enc = fn($s) => '=?UTF-8?B?' . base64_encode($s) . '?=';
    $headers = ['From: ' . $enc($settings['fromName'] ?: 'R3seller') . " <$from>", 'To: ' . implode(', ', $to), 'Subject: ' . $enc($subject),
      'Date: ' . date('r'), 'Message-ID: <' . bin2hex(random_bytes(8)) . '@r3seller.potenttial.com>', 'MIME-Version: 1.0',
      'Content-Type: text/html; charset=UTF-8', 'Content-Transfer-Encoding: base64'];
    fwrite($fp, implode("\r\n", $headers) . "\r\n\r\n" . chunk_split(base64_encode($html)) . "\r\n.\r\n");
    $r = $read(); if ((int)substr($r, 0, 3) !== 250) throw new RuntimeException(trim($r));
    $cmd('QUIT', [221]); fclose($fp); return [true, 'Enviado'];
  } catch (Throwable $e) { @fclose($fp); return [false, 'SMTP: ' . $e->getMessage()]; }
}
function log_mail(array &$db, string $what, array $to, array $res): void {
  array_unshift($db['log'], ['t' => date('c'), 'what' => $what, 'to' => implode(', ', $to), 'ok' => $res[0], 'msg' => $res[1]]);
  $db['log'] = array_slice($db['log'], 0, 100);
}

/* ---------- plantillas de correo ---------- */
function h(?string $s): string { return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); }
function money_fmt(float $n, string $cur): string { return $cur . ' ' . number_format($n, 0, '.', ','); }
function shell(string $inner, bool $en): string {
  return '<div style="font-family:Helvetica Neue,Helvetica,Arial,sans-serif;font-weight:300;color:#111;max-width:640px;margin:0 auto">'
    . '<div style="font-size:26px;letter-spacing:-.03em">R<span style="color:#e7000b">3</span>seller</div>'
    . '<div style="font-size:12px;color:#6e6e6e;font-style:italic;margin-bottom:18px">sales is hunting</div>' . $inner
    . '<p style="color:#6e6e6e;font-size:12px;margin-top:24px;border-top:1px solid #eee;padding-top:12px">' . ($en ? 'Built with N3 Labs technology · Potenttial Group' : 'Hecho con tecnología N3 Labs · Potenttial Group') . '</p></div>';
}
function mail_access(string $name, string $user, string $pass, bool $en, string $label): array {
  $subj = $en ? "Your R3seller access · $label × Potenttial Group" : "Tus accesos a R3seller · $label × Potenttial Group";
  $in = '<p>' . ($en ? 'Hi ' : 'Hola ') . h($name) . ',</p><p>' . ($en ? 'Your sales dashboard with Potenttial Group is ready.' : 'Tu dashboard de ventas con Potenttial Group está listo.') . '</p>'
    . '<p style="background:#f5f5f5;border-radius:10px;padding:14px;line-height:1.8"><b>URL:</b> <a href="' . APP_URL . '" style="color:#D2322A">' . APP_URL . '</a><br><b>' . ($en ? 'Username' : 'Usuario') . ':</b> ' . h($user) . '<br><b>' . ($en ? 'Password' : 'Contraseña') . ':</b> ' . h($pass) . '</p>';
  return [$subj, shell($in, $en)];
}
function report_html(array $db, array $a): array {
  $en = ($a['lang'] ?? 'es') === 'en'; $fx = (float)($db['settings']['fx'] ?: 18.5); $cur = 'USD';
  $L = rows_for_ally($db, $a);
  $val = fn($r) => $r['cur'] === $cur ? $r['amount'] : $r['amount'] / $fx;
  $tot = 0; $won = 0; $adv = 0; $by = array_fill_keys(STAGES, 0);
  foreach ($L as $r) { $v = $val($r); $tot += $v; $by[$r['status']]++; if ($r['status'] === 'Cierre') $won += $v; if (in_array($r['status'], ['Presentada', 'Followup', 'Cierre'])) $adv++; }
  $open = array_values(array_filter($L, fn($r) => $r['status'] !== 'Cierre'));
  usort($open, fn($x, $y) => $val($y) <=> $val($x));
  $st = fn($s) => $en ? STAGES_EN[$s] : $s;
  $k = fn($l, $v, $c = '#111') => '<td style="border:1px solid #e5e5e5;padding:10px;width:25%"><div style="font-size:11px;color:#6e6e6e">' . $l . '</div><div style="font-size:19px;color:' . $c . '">' . $v . '</div></td>';
  $td = 'padding:6px;border-bottom:1px solid #eee';
  $in = '<h2 style="font-weight:300;margin:0 0 4px">' . ($en ? 'Sales dashboard · ' : 'Dashboard de ventas · ') . h($a['name']) . '</h2>'
    . '<p style="margin:0;color:#4a4a4a">' . ($en ? 'Weekly update · ' : 'Actualización semanal · ') . date('d/m/Y') . '</p>'
    . '<table style="width:100%;border-spacing:6px;margin:12px 0"><tr>' . $k($en ? 'Opportunities' : 'Oportunidades', (string)count($L)) . $k($en ? 'Total pipeline' : 'Pipeline total', money_fmt($tot, $cur))
    . $k($en ? 'Closed amount' : 'Monto en cierre', money_fmt($won, $cur), '#0E8058') . $k($en ? 'Reached proposal' : 'Avance a propuesta', (count($L) ? round($adv / count($L) * 100) : 0) . '%') . '</tr></table>'
    . '<p><b>' . ($en ? 'Funnel' : 'Embudo') . ':</b> ' . implode(' · ', array_map(fn($s) => $st($s) . ' ' . $by[$s], STAGES)) . '</p>'
    . '<table style="width:100%;border-collapse:collapse;font-size:13px"><tr style="color:#6e6e6e;text-align:left"><th style="' . $td . '">' . ($en ? 'Brand' : 'Marca') . '</th><th style="' . $td . '">Status</th><th style="' . $td . '">Next step</th><th style="' . $td . ';text-align:right">' . ($en ? 'Amount' : 'Monto') . '</th></tr>';
  foreach (array_slice($open, 0, 10) as $r) $in .= '<tr><td style="' . $td . '">' . h($r['brand']) . '</td><td style="' . $td . '">' . h($st($r['status'])) . '</td><td style="' . $td . '">' . h($r['next']) . '</td><td style="' . $td . ';text-align:right">' . money_fmt($r['amount'], $r['cur']) . '</td></tr>';
  $in .= '</table>';
  $U = array_filter($db['utms'], fn($u) => $u['ally'] === $a['id']);
  if ($U) { $in .= '<p style="margin-top:16px"><b>' . ($en ? 'Traffic sent by Potenttial Group' : 'Tráfico enviado por Potenttial Group') . ':</b> ' . ($en ? 'every visit with utm_source=potenttial_group comes from us.' : 'toda visita con utm_source=potenttial_group viene de nosotros.') . '</p><ul style="font-size:12.5px">';
    foreach ($U as $u) $in .= '<li>' . h($u['campaign']) . ' · utm_medium=' . h($u['medium']) . '</li>'; $in .= '</ul>'; }
  $in .= '<p style="margin-top:16px"><a href="' . APP_URL . '" style="color:#D2322A">' . ($en ? 'Open full dashboard' : 'Abrir dashboard completo') . ' → r3seller.potenttial.com</a></p>';
  return [($en ? 'R3seller · ' . $a['name'] . ' — weekly sales report' : 'R3seller · ' . $a['name'] . ' — reporte semanal de ventas'), shell($in, $en)];
}
function utm_html(array $a, array $u): array {
  $en = ($a['lang'] ?? 'es') === 'en';
  $in = '<p>' . ($en ? 'Hi ' : 'Hola ') . h($a['contact'] ?: $a['name']) . ',</p><p>' . ($en ? 'We are sending visits to your site through this link. In your analytics, every session with <b>utm_source=potenttial_group</b> comes from Potenttial Group.' : 'Estamos enviando visitas a tu sitio con esta liga. En tu analítica, toda sesión con <b>utm_source=potenttial_group</b> viene de Potenttial Group.') . '</p>'
    . '<p style="background:#f5f5f5;border-radius:10px;padding:12px;word-break:break-all;font-size:12.5px">' . h($u['link']) . '</p>'
    . '<p style="font-size:13px;line-height:1.7">utm_source = potenttial_group<br>utm_medium = ' . h($u['medium']) . '<br>utm_campaign = ' . h($u['campaign']) . ($u['seller'] ? '<br>utm_content = ' . h(slug($u['seller'])) . ' (' . h($u['seller']) . ')' : '') . '</p>'
    . '<p><a href="' . APP_URL . '" style="color:#D2322A">r3seller.potenttial.com</a></p>';
  return [($en ? 'Potenttial Group traffic is on its way · ' : 'Tráfico de Potenttial Group en camino · ') . $u['campaign'], shell($in, $en)];
}
function report_recipients(array $a): array { return array_values(array_filter(array_map('trim', explode(',', (string)(($a['report']['to'] ?? '') ?: ($a['email'] ?? '')))))); }

/* ---------- Google Forms del aliado (registro de leads) ---------- */
function http_req(string $url, ?string $post = null): array {
  $c = curl_init($url);
  $o = [CURLOPT_RETURNTRANSFER => true, CURLOPT_FOLLOWLOCATION => true, CURLOPT_TIMEOUT => 25, CURLOPT_USERAGENT => 'Mozilla/5.0 (R3seller)'];
  if ($post !== null) { $o[CURLOPT_POST] = true; $o[CURLOPT_POSTFIELDS] = $post; $o[CURLOPT_HTTPHEADER] = ['Content-Type: application/x-www-form-urlencoded']; }
  curl_setopt_array($c, $o);
  $body = curl_exec($c); $code = (int)curl_getinfo($c, CURLINFO_HTTP_CODE); $final = (string)curl_getinfo($c, CURLINFO_EFFECTIVE_URL); curl_close($c);
  return [$body === false ? '' : (string)$body, $code, $final];
}
function form_schema_from_html(string $html, string $finalUrl): ?array {
  if (!preg_match('~FB_PUBLIC_LOAD_DATA_\s*=\s*(.*?);\s*</script>~s', $html, $m)) return null;
  $d = json_decode($m[1], true); if (!is_array($d) || !isset($d[1][1]) || !is_array($d[1][1])) return null;
  if (!preg_match('~/forms/d/e/([\w-]+)~', $finalUrl . ' ' . $html, $id)) return null;
  $fields = []; $pages = 0;
  foreach ($d[1][1] as $it) {
    $type = (int)($it[3] ?? -1);
    if ($type === 8) { $pages++; continue; }
    if (empty($it[4]) || !is_array($it[4]) || $type === 7) continue; // sin campo o cuadrícula
    $sub = $it[4][0];
    $opts = array_values(array_filter(array_map(fn($o) => (string)($o[0] ?? ''), (array)($sub[1] ?? [])), fn($x) => $x !== ''));
    $fields[] = ['entry' => (string)$sub[0], 'title' => trim((string)($it[1] ?? '')), 'help' => trim((string)($it[2] ?? '')),
      'type' => [0 => 'text', 1 => 'textarea', 2 => 'radio', 3 => 'select', 4 => 'checkbox', 9 => 'date', 10 => 'time', 5 => 'radio'][$type] ?? 'text',
      'opts' => $opts, 'req' => !empty($sub[2])];
  }
  return ['formId' => $id[1], 'title' => (string)($d[1][8] ?? $d[3] ?? 'Formulario'), 'pages' => $pages, 'fields' => $fields, 'at' => time()];
}
function form_schema(array $ally): array {
  if (empty($ally['form'])) return [null, 'Este aliado no tiene formulario de registro'];
  [$html, $code, $final] = http_req($ally['form']);
  if ($code >= 400 || $html === '') return [null, "No se pudo abrir el formulario ($code)"];
  $s = form_schema_from_html($html, $final);
  return $s ? [$s, ''] : [null, 'No pude leer los campos del formulario (¿pide iniciar sesión en Google?)'];
}
function form_submit(array $schema, array $answers): array {
  $parts = [];
  foreach ($schema['fields'] as $f) {
    $v = $answers[$f['entry']] ?? null; if ($v === null || $v === '' || $v === []) continue;
    foreach ((array)$v as $one) $parts[] = 'entry.' . rawurlencode($f['entry']) . '=' . rawurlencode((string)$one);
  }
  $parts[] = 'fvv=1';
  $parts[] = 'pageHistory=' . implode(',', range(0, (int)$schema['pages']));
  [$body, $code] = http_req('https://docs.google.com/forms/d/e/' . $schema['formId'] . '/formResponse', implode('&', $parts));
  if ($code === 200 && stripos($body, 'freebirdFormviewerViewResponseConfirmationMessage') !== false) return [true, 'Registrado en el formulario'];
  if ($code === 200) return [true, 'Enviado al formulario (respuesta 200)'];
  return [false, "El formulario respondió $code"];
}
