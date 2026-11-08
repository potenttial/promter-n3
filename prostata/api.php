<?php
/* Test Próstata 2027 · CURAQ × N3 Labs — API de votos (sin base de datos)
   GET  api.php?ev=EVENTO            -> todos los votos del evento (JSON)
   POST api.php?ev=EVENTO&id=UID     -> guarda/actualiza las respuestas de un participante
   Los votos se guardan en data/EVENTO.json (bloqueo de archivo para escrituras simultáneas). */

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { exit; }

$ev = preg_replace('/[^a-z0-9_-]/i', '', $_GET['ev'] ?? 'conferencia-2026');
if ($ev === '' || strlen($ev) > 60) { http_response_code(400); exit('{"error":"evento"}'); }

$dir = __DIR__ . '/data';
if (!is_dir($dir)) { mkdir($dir, 0755, true); }
$file = "$dir/$ev.json";

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
  echo is_file($file) ? file_get_contents($file) : '{}';
  exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); exit('{"error":"metodo"}'); }

$id = preg_replace('/[^a-z0-9]/i', '', $_GET['id'] ?? '');
if ($id === '' || strlen($id) > 40) { http_response_code(400); exit('{"error":"id"}'); }

$raw = file_get_contents('php://input', false, null, 0, 4096);
$in = json_decode($raw, true);
if (!is_array($in)) { http_response_code(400); exit('{"error":"json"}'); }

// Solo se aceptan las claves del test y valores enteros (o listas de enteros) pequeños
$allowed = ['perfil','q1','q2','q3','q4','q5','q6','q7','q8'];
$patch = [];
foreach ($allowed as $k) {
  if (!array_key_exists($k, $in)) continue;
  $v = $in[$k];
  if (is_int($v) && $v >= 0 && $v < 10) { $patch[$k] = $v; }
  elseif (is_array($v) && count($v) <= 10) {
    $clean = array_values(array_unique(array_filter($v, fn($x) => is_int($x) && $x >= 0 && $x < 10)));
    sort($clean); $patch[$k] = $clean;
  }
}
if (!$patch) { http_response_code(400); exit('{"error":"vacio"}'); }
$patch['t'] = (int) round(microtime(true) * 1000);

$fp = fopen($file, 'c+');
if (!$fp || !flock($fp, LOCK_EX)) { http_response_code(500); exit('{"error":"bloqueo"}'); }
$data = json_decode(stream_get_contents($fp) ?: '{}', true) ?: [];
if (!isset($data[$id]) && count($data) >= 5000) { flock($fp, LOCK_UN); fclose($fp); http_response_code(429); exit('{"error":"limite"}'); }
$data[$id] = array_merge($data[$id] ?? [], $patch);
ftruncate($fp, 0); rewind($fp);
fwrite($fp, json_encode($data, JSON_UNESCAPED_UNICODE));
fflush($fp); flock($fp, LOCK_UN); fclose($fp);
echo '{"ok":true}';
