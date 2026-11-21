# Setup: browser, profile and sign-ins

Read this when the run has no browser yet (none in the request and no saved choice), when the user asks to change it, or when a site or the app turns out to be signed out.

## Pick the browser

**Pick the browser** before anything else, in this order:
1. A browser named in the request (`browser=ego`, `browser=devtools`, "크롬으로", "Ego 로") wins for this run. A request to change it ("브라우저 바꿔줘", "다른 크롬 프로필로") means: ask again (step 3) and save the new answer.
2. Otherwise read the saved choice: `cat ~/.config/affirun/source-finder.json` (`{ "browser": "chrome" | "devtools" | "ego", "chrome": { "deviceId", "name" }, "ego": { "profileId", "name" } }`). Use it without asking.
3. No saved choice: find what this machine has. Chrome is there when the `mcp__claude-in-chrome__*` tools are (loaded or deferred); Chrome through DevTools (`devtools`) when the `chrome-devtools` MCP tools are (`new_page`, `evaluate_script`, `take_screenshot`) and Claude in Chrome is not; Ego Lite when `ego-browser --version` succeeds (the same command in bash, zsh, PowerShell and cmd). With Chrome and Ego Lite both, ask the user which one to use (with `AskUserQuestion` when that tool exists, otherwise in chat; Chrome: "내 크롬, 로그인된 그대로"; Ego Lite: "검색이 빠르고 결과가 덜 막힘, 사이트 로그인은 따로"). With one, use it and do not ask. Then the profile:
   - Chrome: `list_connected_browsers`. With more than one, ask which (its `name`, OS, and which is in use now) and `select_browser` the chosen `deviceId`. A browser on another computer cannot open this computer's files: leave it out of the choices.
   - Ego Lite: `ego-browser nodejs -e 'console.log(JSON.stringify(await profiles()))'`. With more than one, ask which.
   - `devtools`: nothing to pick; it attaches to the Chrome that is running.
   Save the answers to `~/.config/affirun/source-finder.json` (`mkdir -p ~/.config/affirun` first) and tell the user in one line that the choice is saved and that "브라우저 바꿔줘" changes it.
4. Every run then applies the saved profile: Chrome calls `select_browser` with the saved `deviceId` before its first tab (a `deviceId` no longer in `list_connected_browsers` means ask again); Ego Lite creates its TaskSpace with `taskSpace("<name>", { profileId })`, since the profile applies only when a space is created.

## Sign-ins

- The user's Chrome must be signed in to TikTok, Douyin and RedNote (and 1688 if you use it; Instagram for an Instagram search: if it is signed out and shows saved profiles, do not pick one, ask the user to sign in, since they run accounts there). Logged out, Douyin and RedNote show no search results at all. If a site shows a login wall, ask the user to sign in in that Chrome window and wait.
- **Chrome must also be signed in to the Affirun app as the account the MCP acts as.** Check it before the run: open the app in your tab and see that it does not redirect to `/login`. Signed out, the session page opens `/login` and the downloader never starts fetching (2026-11-19, run 1). Never type a password: ask the user to sign in. A sub-agent running as part of a batch never opens the session `url` while signed out: it saves the session and reports the `url`.
