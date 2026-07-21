<?php
/**
 * order.php — приём заявки из конструктора «Оконика».
 * Принимает JSON от формы (checkout.js), отправляет уведомление в Telegram и на
 * почту компании, шлёт письмо-подтверждение клиенту, пишет заявку в лог-файл.
 *
 * НАСТРОЙКА: заполните константы в блоке CONFIG ниже (токен бота, chat_id, почты).
 * Файл кладётся в корень сайта рядом с index.html (fetch('order.php')).
 */

// ==================== CONFIG (заполнить своими значениями) ====================
const TG_BOT_TOKEN = '';       // токен от @BotFather
const TG_CHAT_ID   = '';          // куда слать (ваш id или id группы)
const MAIL_TO      = 'info@okonika.ru';           // почта компании (куда заявка)
const MAIL_FROM    = 'no-reply@okonika.ru';       // от кого письма (домен вашего сайта)
const COMPANY_NAME = 'Оконика';
const LOG_FILE     = __DIR__ . '/orders.log';     // лог заявок (защитить от веб-доступа, см. README)
// =============================================================================

header('Content-Type: application/json; charset=utf-8');

// Константы в переменные — чтобы работала интерполяция в строках "{$company}"
$company = COMPANY_NAME;

// --- Разрешаем только POST ---
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'method']);
    exit;
}

// --- Читаем и разбираем JSON тела запроса ---
$raw = file_get_contents('php://input');
$data = json_decode($raw, true);

if (!is_array($data) || empty($data['customer']) || empty($data['items'])) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'bad_request']);
    exit;
}

// --- Санитизация ввода (без зависимости от mbstring) ---
function clean($v)
{
    $s = trim((string)($v ?? ''));
    if (function_exists('mb_substr')) {
        return mb_substr($s, 0, 500);
    }
    return substr($s, 0, 500);
}

function strlen_u($s)
{
    return function_exists('mb_strlen') ? mb_strlen($s) : strlen($s);
}

$c = $data['customer'];
$name    = clean($c['name'] ?? '');
$phone   = clean($c['phone'] ?? '');
$email   = clean($c['email'] ?? '');
$comment = clean($c['comment'] ?? '');
$consent = !empty($c['consent']);

// --- Валидация на сервере (не доверяем только фронту) ---
$errors = [];
if (strlen_u($name) < 2)                                    $errors[] = 'name';
if (preg_match_all('/\d/', $phone) < 10)                    $errors[] = 'phone';
if (!filter_var($email, FILTER_VALIDATE_EMAIL))            $errors[] = 'email';
if (!$consent)                                              $errors[] = 'consent';
if (!is_array($data['items']) || count($data['items']) === 0) $errors[] = 'items';

if ($errors) {
    http_response_code(422);
    echo json_encode(['ok' => false, 'error' => 'validation', 'fields' => $errors]);
    exit;
}

// --- Номер заказа: доверяем клиентскому, иначе генерируем ---
$orderNumber = clean($data['orderNumber'] ?? '');
if ($orderNumber === '') {
    $orderNumber = 'ОК-' . date('ymd') . '-' . random_int(1000, 9999);
}

// Итог: берём отформатированный из клиента (уже со знаком «≈»),
// иначе строим fallback тоже со знаком «≈» (цена на сайте примерная).
$totalFormatted = clean($data['totalFormatted'] ?? '≈ ' . ($data['total'] ?? '0') . ' ₽');

// Экранирование для Telegram HTML (имя/комментарий могут содержать < > &).
function esc($s)
{
    return htmlspecialchars((string) $s, ENT_QUOTES, 'UTF-8');
}

// Ширина «метки» детали (в символах) для выравнивания колонки в моноширинном
// блоке: «• Профиль:    Стандарт». Считаем по самой длинной метке всех позиций.
function detailLabelWidth(array $items)
{
    $max = 0;
    foreach ($items as $it) {
        foreach (($it['details'] ?? []) as $d) {
            if (stripos($d, 'Створок:') === 0) {
                continue; // эту строку в бота не выводим
            }
            $pos = mb_strpos($d, ':');
            if ($pos !== false) {
                $max = max($max, mb_strlen(mb_substr($d, 0, $pos + 1))); // с двоеточием
            }
        }
    }
    return $max;
}

// --- Состав позиций: для Telegram (HTML) и для писем (plain) ---
$labelW = detailLabelWidth($data['items']);
$itemsHtml  = ''; // цитаты-блоки для бота
$itemsPlain = ''; // без разметки для email
foreach ($data['items'] as $i => $it) {
    $n     = $i + 1;
    $title = clean($it['title'] ?? 'Окно');
    $size  = clean($it['size'] ?? '');
    // Цена с разделителем тысяч: 24471 → «24 471» (неразрывный пробел)
    $price = number_format((int) ($it['price'] ?? 0), 0, '', "\u{00A0}");

    // Шапка позиции (цитата)
    $head = "<b>{$n}.  " . esc($title) . '</b>'
        . "\n📐  " . esc($size)
        . "\n💸  ≈ {$price} ₽";

    // Письмо (plain): заголовок позиции
    $itemsPlain .= "{$n}. {$title}, {$size} — ≈ {$price} руб.\n";

    // Детали в моноширинном блоке с выровненными колонками
    $lines = '';
    foreach (($it['details'] ?? []) as $d) {
        $d = clean($d);
        if (stripos($d, 'Створок:') === 0) {
            continue; // число створок опускаем — видно по списку
        }
        $pos = mb_strpos($d, ':');
        if ($pos !== false) {
            $label = mb_substr($d, 0, $pos + 1);   // «Профиль:»
            $value = trim(mb_substr($d, $pos + 1)); // «Стандарт»
            $pad   = str_repeat(' ', max(1, $labelW - mb_strlen($label) + 2));
            $lines .= '• ' . $label . $pad . $value . "\n";
        } else {
            $lines .= '• ' . $d . "\n";
        }
        $itemsPlain .= '   - ' . $d . "\n";
    }

    $mono = $lines !== '' ? "\n<code>" . esc(rtrim($lines, "\n")) . '</code>' : '';
    $itemsHtml .= "<blockquote expandable>{$head}{$mono}</blockquote>\n";
}

// ==================== 1. Лог в файл (сначала — надёжно) ====================
$logLine = json_encode([
    'time'   => date('c'),
    'order'  => $orderNumber,
    'name'   => $name,
    'phone'  => $phone,
    'email'  => $email,
    'comment' => $comment,
    'total'  => $data['total'] ?? null,
    'items'  => $data['items'],
    'ip'     => $_SERVER['REMOTE_ADDR'] ?? '',
], JSON_UNESCAPED_UNICODE);
@file_put_contents(LOG_FILE, $logLine . "\n", FILE_APPEND | LOCK_EX);

// ==================== 2. Telegram ====================
function sendTelegram($text)
{
    if (TG_BOT_TOKEN === 'ВСТАВЬТЕ_ТОКЕН_БОТА') return false;
    $url = 'https://api.telegram.org/bot' . TG_BOT_TOKEN . '/sendMessage';
    $payload = http_build_query([
        'chat_id' => TG_CHAT_ID,
        'text' => $text,
        'parse_mode' => 'HTML',
    ]);
    $ctx = stream_context_create([
        'http' => [
            'method' => 'POST',
            'header' => "Content-Type: application/x-www-form-urlencoded\r\n",
            'content' => $payload,
            'timeout' => 10,
        ],
    ]);
    $res = @file_get_contents($url, false, $ctx);
    return $res !== false;
}

// Дата и время заявки (по времени сервера)
$dateStr = date('d.m.Y');
$timeStr = date('H:i');

// Контакты — цитатой, НЕкликабельные (просто текст).
$contacts = "<blockquote>🧑🏻‍💼  " . esc($name) . "\n"
    . "☎️  " . esc($phone) . "\n"
    . "✉️  " . esc($email)
    . ($comment ? "\n💭  " . esc($comment) : '')
    . '</blockquote>';

$tgText = "<b><i>№ {$orderNumber}</i></b>\n"
    . "📅  {$dateStr}       🕝  {$timeStr}\n\n"
    . $contacts . "\n"
    . "📋  <b>Состав заказа:</b>\n\n"
    . $itemsHtml
    . "\n💸  <b>Итого: {$totalFormatted}</b>";
$tgOk = sendTelegram($tgText);

// ==================== 3. Письмо компании ====================
$headersCompany = "From: {$company} <" . MAIL_FROM . ">\r\n"
    . "Reply-To: {$email}\r\n"
    . "Content-Type: text/plain; charset=UTF-8\r\n";
$bodyCompany = "Новая заявка {$orderNumber}\n\n"
    . "Имя: {$name}\nТелефон: {$phone}\nEmail: {$email}\n"
    . ($comment ? "Комментарий: {$comment}\n" : '')
    . "\nСостав:\n{$itemsPlain}\nИтого: {$totalFormatted}\n";
$mailCompanyOk = @mail(MAIL_TO, "Заявка {$orderNumber} — {$company}", $bodyCompany, $headersCompany);

// ==================== 4. Письмо-подтверждение клиенту ====================
$headersClient = "From: {$company} <" . MAIL_FROM . ">\r\n"
    . "Content-Type: text/plain; charset=UTF-8\r\n";
$bodyClient = "Здравствуйте, {$name}!\n\n"
    . "Спасибо за заявку в «{$company}». Ваш номер заказа: {$orderNumber}.\n"
    . "Мы свяжемся с вами в ближайшее время.\n\n"
    . "Состав заказа:\n{$itemsPlain}\nИтого: {$totalFormatted}\n\n"
    . "С уважением, команда «{$company}».";
@mail($email, "Ваш заказ {$orderNumber} принят — {$company}", $bodyClient, $headersClient);

// ==================== Ответ фронту ====================
// Успех, если удалось хотя бы залогировать (уведомления — best effort).
echo json_encode([
    'ok' => true,
    'orderNumber' => $orderNumber,
    'delivered' => ['telegram' => $tgOk, 'emailCompany' => $mailCompanyOk],
], JSON_UNESCAPED_UNICODE);
