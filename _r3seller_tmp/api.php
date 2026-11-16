<?php
declare(strict_types=1);
require __DIR__ . '/lib.php';
session_set_cookie_params(['lifetime' => 0, 'path' => '/', 'secure' => !empty($_SERVER['HTTPS']), 'httponly' => true, 'samesite' => 'Strict']);
session_name('r3s');
session_start();
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$in = json_decode((string)file_get_contents('php://input'), true) ?: [];
$action = (string)($in['action'] ?? $_GET['action'] ?? '');
$db = db_load();
$sess = $_SESSION['u'] ?? null;

function out($d, int $code = 200) { http_response_code($code); echo json_encode($d, JSON_UNESCAPED_UNICODE); exit; }
function fail(string $m, int $code = 400) { out(['ok' => false, 'error' => $m], $code); }
function need_admin($sess) { if (($sess['role'] ?? '') !== 'admin') fail('Sin permiso', 403); }
function new_pass(): string { $c = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'; $s = ''; for ($i = 0; $i < 10; $i++) $s .= $c[random_int(0, strlen($c) - 1)]; return $s; }
function me_info(array $db, ?array $sess): ?array {
  if (!$sess) return null;
  if ($sess['role'] === 'admin') return ['role' => 'admin', 'name' => $db['admin']['name'] ?? 'Admin'];
  if ($sess['role'] === 'ally') { $a = find_by($db['allies'], 'id', $sess['id']); return $a ? ['role' => 'ally', 'id' => $a['id'], 'name' => $a['name'], 'lang' => $a['lang']] : null; }
  $s = find_by($db['sellers'], 'id', $sess['id']); return $s ? ['role' => 'seller', 'id' => $s['id'], 'name' => $s['name']] : null;
}
function views(array $db, array $sess): array {
  $v = [];
  if ($sess['role'] === 'admin') {
    $v[] = ['type' => 'admin', 'id' => '', 'label' => 'Administración · todo', 'group' => 'Administrador'];
    foreach ($db['allies'] as $a) $v[] = ['type' => 'ally', 'id' => $a['id'], 'label' => $a['name'], 'group' => 'Aliados'];
    foreach ($db['sellers'] as $s) $v[] = ['type' => 'seller', 'id' => $s['id'], 'label' => $s['name'], 'group' => 'Vendedores'];
  } elseif ($sess['role'] === 'seller') {
    $me = find_by($db['sellers'], 'id', $sess['id']);
    $v[] = ['type' => 'seller', 'id' => $me['id'], 'label' => 'Mi vista de vendedor', 'group' => ''];
    foreach ($db['allies'] as $a) if (in_array($a['id'], $me['allies'], true)) $v[] = ['type' => 'ally', 'id' => $a['id'], 'label' => $a['name'], 'group' => 'Vista del aliado'];
  } else { $v[] = ['type' => 'ally', 'id' => $sess['id'], 'label' => '', 'group' => '']; }
  return $v;
}

switch ($action) {
  case 'status':
    out(['ok' => true, 'setup' => $db['admin'] === null, 'me' => me_info($db, $sess)]);

  case 'setup':
    if ($db['admin'] !== null) fail('Ya está configurado', 403);
    $email = strtolower(trim((string)($in['email'] ?? ''))); $pass = (string)($in['pass'] ?? '');
    if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($pass) < 8) fail('Email válido y contraseña de 8+ caracteres');
    $db['admin'] = ['email' => $email, 'name' => trim((string)($in['name'] ?? '')) ?: 'Administrador', 'hash' => password_hash($pass, PASSWORD_DEFAULT)];
    db_save($db); session_regenerate_id(true); $_SESSION['u'] = ['role' => 'admin']; out(['ok' => true, 'me' => me_info($db, $_SESSION['u'])]);

  case 'login':
    $u = strtolower(trim((string)($in['u'] ?? ''))); $p = (string)($in['p'] ?? ''); $who = null;
    if ($db['admin'] && $u === $db['admin']['email'] && password_verify($p, $db['admin']['hash'])) $who = ['role' => 'admin'];
    if (!$who) foreach ($db['sellers'] as $s) if ($s['hash'] && strtolower($s['email']) === $u && password_verify($p, $s['hash'])) { $who = ['role' => 'seller', 'id' => $s['id']]; break; }
    if (!$who) foreach ($db['allies'] as $a) if ($a['hash'] && (strtolower($a['user']) === $u || ($a['email'] && strtolower($a['email']) === $u)) && password_verify($p, $a['hash'])) { $who = ['role' => 'ally', 'id' => $a['id']]; break; }
    if (!$who) { usleep(800000); fail('Usuario o contraseña incorrectos', 401); }
    session_regenerate_id(true); $_SESSION['u'] = $who; out(['ok' => true, 'me' => me_info($db, $who)]);

  case 'logout':
    $_SESSION = []; session_destroy(); out(['ok' => true]);
}

if (!$sess || !me_info($db, $sess)) fail('Sesión expirada', 401);

switch ($action) {
  case 'views': out(['ok' => true, 'views' => views($db, $sess)]);

  case 'dash':
    $v = ['type' => (string)($in['type'] ?? ''), 'id' => (string)($in['id'] ?? '')];
    if (!can_view($sess, $db, $v)) fail('Sin permiso para esta vista', 403);
    sync_sheet($db); db_save($db);
    $a = $v['type'] === 'ally' ? find_by($db['allies'], 'id', $v['id']) : null;
    $s = $v['type'] === 'seller' ? find_by($db['sellers'], 'id', $v['id']) : null;
    $team = $a ? array_values(array_filter($db['sellers'], fn($x) => in_array($a['id'], $x['allies'], true))) : ($s ? [$s] : $db['sellers']);
    $utms = $a ? array_filter($db['utms'], fn($u) => $u['ally'] === $a['id']) : ($s ? array_filter($db['utms'], fn($u) => norm($u['seller']) === norm($s['name'])) : $db['utms']);
    $formsFrom = $a ? [$a] : ($s ? array_filter($db['allies'], fn($x) => in_array($x['id'], $s['allies'], true)) : []);
    out(['ok' => true, 'view' => $v, 'label' => $a['name'] ?? ($s['name'] ?? ''), 'rows' => scope($db, $v),
      'team' => array_map('public_seller', array_values($team)), 'utms' => array_values(array_map(fn($u) => array_intersect_key($u, array_flip(['campaign', 'medium', 'seller', 'link'])), $utms)),
      'forms' => array_values(array_map(fn($x) => ['name' => $x['name'], 'url' => $x['form']], array_filter($formsFrom, fn($x) => !empty($x['form'])))),
      'leads' => array_values(array_map(fn($l) => lead_public($l, $db), array_slice(array_values(array_filter($db['leads'] ?? [], fn($l) => $a ? ($l['ally'] === $a['id'] && ($sess['role'] !== 'ally' || $l['ok'])) : ($s ? (($l['byId'] ?? '') === $s['id']) : true))), 0, 50))),
      'fx' => (float)$db['settings']['fx'], 'sync' => (int)$db['cache']['at'], 'error' => $sess['role'] === 'admin' ? $db['cache']['error'] : '']);
}

function lead_allies(array $db, array $sess): array {
  if ($sess['role'] === 'admin') return $db['allies'];
  if ($sess['role'] !== 'seller') return [];
  $me = find_by($db['sellers'], 'id', $sess['id']); return array_values(array_filter($db['allies'], fn($a) => in_array($a['id'], $me['allies'] ?? [], true)));
}
function lead_public(array $l, array $db): array {
  $a = find_by($db['allies'], 'id', $l['ally']);
  return ['t' => $l['t'], 'ally' => $a['name'] ?? '—', 'by' => $l['by'], 'sum' => $l['sum'], 'answers' => $l['answers'], 'ok' => $l['ok'], 'msg' => $l['msg']];
}
switch ($action) {
  case 'leadAllies':
    out(['ok' => true, 'allies' => array_map(fn($a) => ['id' => $a['id'], 'name' => $a['name'], 'hasForm' => !empty($a['form'])], lead_allies($db, $sess))]);

  case 'formSchema':
    $a = find_by(lead_allies($db, $sess), 'id', (string)($in['id'] ?? '')); if (!$a) fail('Sin permiso para este aliado', 403);
    $cached = $a['formSchema'] ?? null;
    if (!$cached || !empty($in['refresh']) || time() - (int)($cached['at'] ?? 0) > 86400 || ($cached['src'] ?? '') !== $a['form']) {
      [$sc, $err] = form_schema($a); if (!$sc) fail($err);
      $sc['src'] = $a['form'];
      foreach ($db['allies'] as &$x) if ($x['id'] === $a['id']) $x['formSchema'] = $sc; unset($x);
      db_save($db); $cached = $sc;
    }
    out(['ok' => true, 'schema' => $cached]);

  case 'registerLead':
    $a = find_by(lead_allies($db, $sess), 'id', (string)($in['id'] ?? '')); if (!$a) fail('Sin permiso para este aliado', 403);
    $sc = $a['formSchema'] ?? null; if (!$sc) fail('Carga primero el formulario');
    $ans = (array)($in['answers'] ?? []); $clean = []; $named = [];
    foreach ($sc['fields'] as $f) {
      $v = $ans[$f['entry']] ?? '';
      if (is_array($v)) { $v = array_values(array_intersect(array_map('strval', $v), $f['opts'])); }
      else { $v = trim((string)$v); if (in_array($f['type'], ['radio', 'select'], true) && $v !== '' && !in_array($v, $f['opts'], true)) $v = ''; }
      if ($f['req'] && ($v === '' || $v === [])) fail('Falta: ' . $f['title']);
      if ($v !== '' && $v !== []) { $clean[$f['entry']] = $v; $named[$f['title']] = is_array($v) ? implode(' / ', $v) : $v; }
    }
    if (!$clean) fail('El formulario está vacío');
    $res = form_submit($sc, $clean);
    $me = me_info($db, $sess);
    $lead = ['t' => date('c'), 'ally' => $a['id'], 'by' => $me['name'] ?? '', 'byId' => $sess['id'] ?? 'admin', 'sum' => implode(' · ', array_slice(array_values(array_filter($named, fn($x) => mb_strlen($x) < 80)), 0, 3)),
      'answers' => $named, 'ok' => $res[0], 'msg' => $res[1]];
    $db['leads'] = $db['leads'] ?? []; array_unshift($db['leads'], $lead); $db['leads'] = array_slice($db['leads'], 0, 3000);
    db_save($db); out(['ok' => true, 'sent' => $res[0], 'msg' => $res[1]]);

  case 'utmState':
    $mine = $sess['role'] === 'seller' ? find_by($db['sellers'], 'id', $sess['id']) : null;
    $al = lead_allies($db, $sess);
    $U = $mine ? array_values(array_filter($db['utms'], fn($u) => norm($u['seller']) === norm($mine['name']))) : $db['utms'];
    out(['ok' => true, 'me' => $mine ? ['name' => $mine['name'], 'email' => $mine['email']] : ['name' => $db['admin']['name'], 'email' => $db['admin']['email']], 'seller' => (bool)$mine,
      'allies' => array_map(fn($a) => ['id' => $a['id'], 'name' => $a['name']], $al), 'sellers' => array_map(fn($x) => ['id' => $x['id'], 'name' => $x['name']], $mine ? [$mine] : $db['sellers']), 'utms' => $U]);

  case 'saveUtm':
    $u = (array)($in['utm'] ?? []); $a = find_by(lead_allies($db, $sess), 'id', (string)($u['ally'] ?? ''));
    if (!$a || !filter_var($u['link'] ?? '', FILTER_VALIDATE_URL)) fail('Liga o aliado inválido');
    $mine = $sess['role'] === 'seller' ? find_by($db['sellers'], 'id', $sess['id']) : null;
    $u = ['t' => (string)round(microtime(true) * 1000), 'ally' => $a['id'], 'link' => (string)$u['link'], 'campaign' => (string)($u['campaign'] ?? ''), 'medium' => (string)($u['medium'] ?? ''), 'seller' => $mine ? $mine['name'] : (string)($u['seller'] ?? '')];
    $db['utms'][] = $u; $mail = null;
    if (!empty($in['notify'])) { [$sj, $ht] = utm_html($a, $u); $to = report_recipients($a); $mail = smtp_send($db['settings'], $to, $sj, $ht); log_mail($db, 'UTM · ' . $a['name'], $to, $mail); }
    db_save($db); out(['ok' => true, 'mail' => $mail]);

  case 'notifyUtm': case 'delUtm':
    $u = find_by($db['utms'], 't', (string)($in['t'] ?? '')); if (!$u) fail('No encontrada');
    if ($sess['role'] === 'seller') { $mine = find_by($db['sellers'], 'id', $sess['id']); if (norm($u['seller']) !== norm($mine['name'] ?? '')) fail('Sin permiso', 403); }
    elseif ($sess['role'] !== 'admin') fail('Sin permiso', 403);
    if ($action === 'delUtm') { $db['utms'] = array_values(array_filter($db['utms'], fn($x) => $x['t'] !== $u['t'])); db_save($db); out(['ok' => true]); }
    $a = find_by($db['allies'], 'id', $u['ally']); if (!$a) fail('Aliado no encontrado');
    [$sj, $ht] = utm_html($a, $u); $to = report_recipients($a); $mail = smtp_send($db['settings'], $to, $sj, $ht); log_mail($db, 'UTM · ' . $a['name'], $to, $mail);
    db_save($db); out(['ok' => true, 'mail' => $mail]);

  case 'myLeads':
    $L = $db['leads'] ?? [];
    if ($sess['role'] === 'seller') $L = array_filter($L, fn($l) => ($l['byId'] ?? '') === $sess['id']);
    elseif ($sess['role'] !== 'admin') fail('Sin permiso', 403);
    out(['ok' => true, 'leads' => array_values(array_map(fn($l) => lead_public($l, $db), array_slice(array_values($L), 0, 200)))]);
}

need_admin($sess);
switch ($action) {
  case 'state':
    $st = $db['settings']; $st['hasSmtpPass'] = !empty($st['smtpPass']); unset($st['smtpPass']);
    $counts = [];
    foreach ($db['allies'] as $a) $counts[$a['id']] = count(rows_for_ally($db, $a));
    out(['ok' => true, 'admin' => ['email' => $db['admin']['email'], 'name' => $db['admin']['name']], 'allies' => array_map('strip_secret', $db['allies']), 'sellers' => array_map('strip_secret', $db['sellers']),
      'utms' => $db['utms'], 'settings' => $st, 'headers' => $db['cache']['headers'], 'rowCount' => count($db['cache']['rows']), 'counts' => $counts, 'log' => array_slice($db['log'], 0, 30), 'sync' => $db['cache']['at'], 'error' => $db['cache']['error']]);

  case 'saveAlly':
    $x = (array)($in['ally'] ?? []); $id = (string)($x['id'] ?? '');
    foreach (['name', 'code', 'user'] as $k) if (trim((string)($x[$k] ?? '')) === '') fail('Faltan nombre, código o usuario');
    $user = strtolower(trim($x['user']));
    foreach ($db['allies'] as $o) if ($o['id'] !== $id && strtolower($o['user']) === $user) fail('Ese usuario ya existe');
    $idx = null; foreach ($db['allies'] as $i => $o) if ($o['id'] === $id) $idx = $i;
    $base = $idx !== null ? $db['allies'][$idx] : ['id' => 'a' . bin2hex(random_bytes(4)), 'hash' => '', 'report' => ['on' => false, 'day' => '1', 'hour' => '08:00', 'to' => '', 'last' => '']];
    $a = array_merge($base, ['name' => trim($x['name']), 'code' => trim($x['code']), 'contact' => trim((string)($x['contact'] ?? '')), 'email' => trim((string)($x['email'] ?? '')),
      'user' => $user, 'lang' => ($x['lang'] ?? 'es') === 'en' ? 'en' : 'es', 'form' => trim((string)($x['form'] ?? ''))]);
    $pass = trim((string)($in['pass'] ?? '')); if ($pass !== '') $a['hash'] = password_hash($pass, PASSWORD_DEFAULT);
    if ($idx === null) { if (!$a['report']['to']) $a['report']['to'] = $a['email']; $db['allies'][] = $a; } else $db['allies'][$idx] = $a;
    $mail = null;
    if (!empty($in['send']) && $pass !== '') { [$sj, $ht] = mail_access($a['contact'] ?: $a['name'], $a['user'], $pass, $a['lang'] === 'en', $a['name']); $mail = smtp_send($db['settings'], [$a['email']], $sj, $ht); log_mail($db, 'Accesos · ' . $a['name'], [$a['email']], $mail); }
    db_save($db); out(['ok' => true, 'id' => $a['id'], 'mail' => $mail]);

  case 'delAlly':
    $id = (string)($in['id'] ?? ''); $db['allies'] = array_values(array_filter($db['allies'], fn($a) => $a['id'] !== $id));
    foreach ($db['sellers'] as &$s) $s['allies'] = array_values(array_diff($s['allies'], [$id])); unset($s);
    db_save($db); out(['ok' => true]);

  case 'saveSeller':
    $x = (array)($in['seller'] ?? []); $id = (string)($x['id'] ?? ''); $email = strtolower(trim((string)($x['email'] ?? '')));
    if (trim((string)($x['name'] ?? '')) === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) fail('Nombre y email válido son obligatorios');
    $pass = trim((string)($in['pass'] ?? ''));
    if ($pass !== '' && $email === $db['admin']['email']) fail('Ese email ya es el acceso de administrador; deja la contraseña vacía');
    foreach ($db['sellers'] as $o) if ($o['id'] !== $id && strtolower($o['email']) === $email) fail('Ese email ya está registrado');
    $idx = null; foreach ($db['sellers'] as $i => $o) if ($o['id'] === $id) $idx = $i;
    $base = $idx !== null ? $db['sellers'][$idx] : ['id' => 's' . bin2hex(random_bytes(4)), 'hash' => ''];
    $ids = array_column($db['allies'], 'id');
    $s = array_merge($base, ['name' => trim($x['name']), 'role' => trim((string)($x['role'] ?? '')), 'email' => $email, 'phone' => trim((string)($x['phone'] ?? '')),
      'allies' => array_values(array_intersect((array)($x['allies'] ?? []), $ids))]);
    if ($pass !== '') $s['hash'] = password_hash($pass, PASSWORD_DEFAULT);
    if ($idx === null) $db['sellers'][] = $s; else $db['sellers'][$idx] = $s;
    $mail = null;
    if (!empty($in['send']) && $pass !== '') { [$sj, $ht] = mail_access($s['name'], $s['email'], $pass, false, 'Vendedor'); $mail = smtp_send($db['settings'], [$s['email']], $sj, $ht); log_mail($db, 'Accesos · ' . $s['name'], [$s['email']], $mail); }
    db_save($db); out(['ok' => true, 'mail' => $mail]);

  case 'delSeller':
    $id = (string)($in['id'] ?? ''); $db['sellers'] = array_values(array_filter($db['sellers'], fn($s) => $s['id'] !== $id)); db_save($db); out(['ok' => true]);

  case 'saveReport':
    $id = (string)($in['id'] ?? ''); $r = (array)($in['report'] ?? []);
    foreach ($db['allies'] as &$a) if ($a['id'] === $id) {
      $a['report'] = array_merge($a['report'], ['on' => !empty($r['on']), 'day' => (string)(int)($r['day'] ?? 1), 'hour' => preg_match('/^\d{2}:\d{2}$/', (string)($r['hour'] ?? '')) ? $r['hour'] : '08:00', 'to' => trim((string)($r['to'] ?? ''))]);
    } unset($a);
    db_save($db); out(['ok' => true]);

  case 'reportPreview': case 'reportSend':
    $a = find_by($db['allies'], 'id', (string)($in['id'] ?? '')); if (!$a) fail('No encontrado');
    sync_sheet($db); [$sj, $ht] = report_html($db, $a); $to = report_recipients($a);
    if ($action === 'reportPreview') { db_save($db); out(['ok' => true, 'subject' => $sj, 'html' => $ht, 'to' => $to, 'from' => $db['settings']['sender']]); }
    $mail = smtp_send($db['settings'], $to, $sj, $ht); log_mail($db, 'Reporte · ' . $a['name'], $to, $mail); db_save($db); out(['ok' => true, 'mail' => $mail]);

  case 'saveSettings':
    $x = (array)($in['settings'] ?? []);
    foreach (['sheetUrl', 'sheetTab', 'sender', 'fromName', 'smtpHost', 'smtpUser'] as $k) if (array_key_exists($k, $x)) $db['settings'][$k] = trim((string)$x[$k]);
    if (isset($x['smtpPort'])) $db['settings']['smtpPort'] = (int)$x['smtpPort'];
    if (isset($x['fx']) && (float)$x['fx'] > 0) $db['settings']['fx'] = (float)$x['fx'];
    if (!empty($x['smtpPass'])) $db['settings']['smtpPass'] = str_replace(' ', '', (string)$x['smtpPass']);
    if (isset($x['map']) && is_array($x['map'])) $db['settings']['map'] = $x['map'];
    if (!empty($in['adminPass'])) { if (strlen($in['adminPass']) < 8) fail('La contraseña debe tener 8+ caracteres'); $db['admin']['hash'] = password_hash((string)$in['adminPass'], PASSWORD_DEFAULT); }
    if (!empty($in['adminName'])) $db['admin']['name'] = trim((string)$in['adminName']);
    if (array_key_exists('sheetUrl', $x) || array_key_exists('sheetTab', $x)) sync_sheet($db, true);
    db_save($db); out(['ok' => true, 'error' => $db['cache']['error']]);

  case 'sync':
    sync_sheet($db, true); db_save($db); out(['ok' => true, 'error' => $db['cache']['error'], 'rows' => count($db['cache']['rows'])]);

  case 'uploadCsv':
    $t = parse_csv((string)($in['csv'] ?? '')); if (count($t) < 2) fail('El CSV no tiene filas');
    load_table($db, $t); db_save($db); out(['ok' => true, 'rows' => count($db['cache']['rows'])]);

  case 'testMail':
    $mail = smtp_send($db['settings'], [$db['admin']['email']], 'R3seller · prueba de correo', shell('<p>El correo de R3seller funciona ✓</p>', false));
    log_mail($db, 'Prueba', [$db['admin']['email']], $mail); db_save($db); out(['ok' => true, 'mail' => $mail]);
}
fail('Acción desconocida', 404);
