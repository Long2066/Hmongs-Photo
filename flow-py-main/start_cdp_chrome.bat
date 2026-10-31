@echo off
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="C:\Users\Admin\.flow-py\cdp-profile" --window-position=100,100 --window-size=1280,900 --no-first-run --no-default-browser-check "https://flow.google.com"
