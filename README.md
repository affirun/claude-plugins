# Affirun plugin for Claude Code

Give Claude a viral product reel and it does two things in your own Chrome:

- **source-video-finder**: searches TikTok, Douyin, RedNote and Instagram for the footage the reel was cut from, opens each video to check it, and grades its subtitles.
- **coupang-product-finder**: finds the Coupang product the reel sells (the caption's link number, the account's link page, or Coupang itself).

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

## 알아 둘 것

- Claude는 검색과 열람만 한다 (좋아요, 팔로우, 댓글, 메시지 없음). 캡차는 풀지 않고 사용자에게 맡긴다. 그래도 자동 검색 기록은 로그인한 계정에 남고, 플랫폼이 계정을 제한할 수 있다.
- Claude 사용량은 본인 Claude 구독에서 나간다.
