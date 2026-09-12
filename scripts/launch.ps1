# 危険物乙4 学習アプリ のランチャ
# デスクトップのショートカットから呼ばれる。
#   1. すでに起動していればブラウザを開くだけ
#   2. 必要なら依存パッケージのインストールとビルドを行う
#   3. ローカルサーバを起動し、ブラウザで開く
# このウィンドウを閉じるとサーバが止まる。

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$Host.UI.RawUI.WindowTitle = '危険物乙4 学習アプリ'

$port = 4173
$url = "http://localhost:$port/"

function Test-Server {
    try {
        $null = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2
        return $true
    } catch {
        return $false
    }
}

Write-Host ''
Write-Host '  危険物乙4 学習アプリ' -ForegroundColor Cyan
Write-Host '  ------------------------------'
Write-Host ''

# すでに動いていれば二重に起動しない
if (Test-Server) {
    Write-Host '  すでに起動しています。ブラウザを開きます。'
    Start-Process $url
    Start-Sleep -Seconds 1
    exit 0
}

try {
    if (-not (Test-Path (Join-Path $root 'node_modules'))) {
        Write-Host '  初回準備：必要なパッケージを取得しています（数分かかります）...'
        npm install --no-fund --no-audit
        if ($LASTEXITCODE -ne 0) { throw 'npm install に失敗しました' }
    }

    # ソースを更新したあとはビルドし直す
    $distIndex = Join-Path $root 'dist\index.html'
    $needBuild = -not (Test-Path $distIndex)
    if (-not $needBuild) {
        $newestSource = Get-ChildItem (Join-Path $root 'src') -Recurse -File -ErrorAction SilentlyContinue |
            Sort-Object LastWriteTime -Descending | Select-Object -First 1
        if ($newestSource -and $newestSource.LastWriteTime -gt (Get-Item $distIndex).LastWriteTime) {
            $needBuild = $true
        }
    }
    if ($needBuild) {
        Write-Host '  アプリをビルドしています...'
        npm run build
        if ($LASTEXITCODE -ne 0) { throw 'ビルドに失敗しました' }
    }
} catch {
    Write-Host ''
    Write-Host "  エラー: $_" -ForegroundColor Red
    Write-Host ''
    Read-Host '  Enter キーで閉じます'
    exit 1
}

# サーバの起動を待ってからブラウザを開く（別プロセスで待機させる）
$opener = @"
for (`$i = 0; `$i -lt 40; `$i++) {
  try { `$null = Invoke-WebRequest -Uri '$url' -UseBasicParsing -TimeoutSec 2; Start-Process '$url'; break } catch { Start-Sleep -Milliseconds 500 }
}
"@
Start-Process -WindowStyle Hidden powershell -ArgumentList '-NoProfile', '-Command', $opener

Write-Host "  ブラウザで $url を開きます。"
Write-Host ''
Write-Host '  スマートフォンからは、下に表示される Network: のアドレスで開けます'
Write-Host '  （同じ Wi-Fi に接続している必要があります）。'
Write-Host ''
Write-Host '  このウィンドウを閉じるとアプリが停止します。' -ForegroundColor Yellow
Write-Host ''

# サーバはこのウィンドウの子プロセスとして動かす（ウィンドウを閉じれば一緒に終了する）
npm run preview -- --port $port --host
