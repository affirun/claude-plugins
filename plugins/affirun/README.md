# Affirun plugin for Claude Code

Give Claude a viral product reel and it does two things in your own Chrome:

- **source-video-finder**: searches TikTok, Douyin, RedNote and Instagram for the footage the reel was cut from, opens each video to check it, and grades its subtitles.
- **coupang-product-finder**: finds the Coupang product the reel sells (the caption's link number, the account's link page, or Coupang itself).
- **source-find-queue**: works through the reels you lined up in the app (벤치마킹 > 원본 찾기, "큐에 넣기"), one at a time, so a scheduled task can find them while you are away. Only for accounts that see the queue in the app.
- **daily-scenarios**: one unattended daily run, from picking about five topics in the breakout feed, through finding source videos for each, to finished AI scenarios you only have to judge. Made for a scheduled task. Only for accounts that have scenario autopilot turned on.

Both save to your Affirun account (벤치마킹 > 원본 찾기), where you play the videos and start a scenario from them.

## 준비

| 필요한 것 | 비고 |
|---|---|
| Claude Code | `claude` 로그인 |
| Claude in Chrome | Claude가 내 크롬 탭을 연다 |
| 어피런 Business 플랜 | 두 스킬 모두 Business 전용이다. 다른 플랜이면 시작하지 않고 결제 안내만 한다 |
| 어피런 다운로더 익스텐션 | 찾은 영상을 앱으로 받는다 |
| `node` 18+, `curl`, `ffmpeg` | 스킬이 쓰는 로컬 도구 |
| 크롬에서 틱톡, 더우인, 레드노트 로그인 | 더우인·레드노트는 로그아웃이면 검색 결과가 없다 |

## 설치

```
/plugin marketplace add affirun/claude-plugins
/plugin install affirun@affirun
```

설치한 뒤 `/mcp` 에서 `affirun` 을 골라 어피런 계정으로 로그인한다 (권한 `read`, `content:create`).

## 업데이트

스킬은 자주 고쳐진다. 직접 추가한 마켓플레이스는 자동 업데이트가 기본으로 꺼져 있으니 한 번 켜 둔다: `/plugin` 의 **Marketplaces** 탭에서 `affirun` 을 골라 자동 업데이트를 켠다. 켜 두면 Claude Code 를 쓰는 동안 새 버전을 받아 다음 세션부터 쓴다.

바로 받으려면 `/plugin` 의 **Installed** 탭에서 `affirun` 을 골라 **Update now** 를 누르거나, 터미널에서 `claude plugin update affirun@affirun` 을 실행한다.

## 쓰기

```
이 릴스 원본 영상 찾아줘 https://www.instagram.com/reel/<code>/
이 릴스 쿠팡 상품 찾아줘 https://www.instagram.com/reel/<code>/
```

기본은 빠른 모드(5~10분)이고, "최대한 찾아줘" 라고 하면 30~60분 동안 꼼꼼히 찾는다.

앱의 원본 찾기 화면에 "찾을 릴스" 칸이 보이는 계정은 릴스를 큐에 쌓아 두고 한 번에 맡길 수 있다:

```
원본 찾기 큐에 있는 릴스 찾아줘
원본 찾기 큐를 예약 작업으로 돌려줘
```

## 알아 둘 것

- Claude는 검색과 열람만 한다 (좋아요, 팔로우, 댓글, 메시지 없음). 캡차는 풀지 않고 사용자에게 맡긴다. 그래도 자동 검색 기록은 로그인한 계정에 남고, 플랫폼이 계정을 제한할 수 있다.
- Claude 사용량은 본인 Claude 구독에서 나간다.

## Data and network access

What the plugin reads, where it sends it, and what stays on your computer.

- **Affirun (`api.affirun.com`)**: the only place results are sent. After you sign in with OAuth (scopes `read`, `content:create`), a run saves the reel code, the videos it found (address, title, account, subtitle grade), the Coupang product (title, price, address, a product picture) and the run's model call and token counts. The token counts are read from the local Claude Code transcript of that run by `skills/source-video-finder/usage.mjs`: numbers only, no message text.
- **Sites opened in your own browser, read only**: Instagram, TikTok, Douyin, RedNote, Coupang, and the reel account's public link page (Inpock, litt.ly, moneying, Affirun). Claude searches and opens pages with your logins. It never likes, follows, comments, messages or buys, and it stops at a CAPTCHA or a login wall.
- **Image search**: a still frame of the reel is uploaded to Google Lens, and with Ego Lite to 1688 image search, to find the same product.
- **The source find queue**: `source-find-queue` reads the reel codes you queued in the app from Affirun and reports back, per reel, that it finished or one line on why it could not. Nothing else is sent.
- **Daily scenarios**: `daily-scenarios` reads your breakout feed, account profiles, posts, source find sessions and scenarios from Affirun, starts scenarios there from the videos it found (this spends your AI credits, up to the daily cap), and answers the questions a scenario stops on. It publishes nothing. It keeps its settings and a log of what each run picked and turned down in `~/.config/affirun/daily-scenarios.json` and `~/.config/affirun/daily-scenarios/runs/`.
- **On your computer**: working files under `./.source-finder/<reel code>/` in the folder you run Claude in (the reel, frames, notes), and your browser choice in `~/.config/affirun/source-finder.json`. Delete them whenever you like.
- **Local tools the skills run**: `node`, `curl`, `ffmpeg`, and `ego-browser` when you chose Ego Lite. Every script is plain JavaScript inside this plugin; nothing is downloaded and run.

Privacy policy: https://affirun.com/legal/privacy · Terms: https://affirun.com/legal/terms

## License

Proprietary. You may install and run the plugin with your own Affirun account; copying, modifying and redistributing it are not permitted. See [LICENSE](LICENSE).
