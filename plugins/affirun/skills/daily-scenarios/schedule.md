# Run the daily scenarios on a schedule

Read this when the user asks to set the daily run up as a scheduled task ("매일 시나리오를 예약 작업으로 돌려줘"), not for a run.

## What the task must be

- **On the computer whose browser is signed in.** The source finder drives that browser, and its downloader extension fetches the videos. A cloud routine cannot reach either, so do not offer one.
- **An empty folder of its own** (for example `~/affirun-daily`). A project folder puts that project's instructions into every call of a run that makes hundreds of calls, and the finder's working files (`./.source-finder/<reel code>/`) land in whatever folder the task runs in.
- **A strong model for the task itself.** Unlike the source find queue, this task does the judging: which topics, which clips, how to answer a paused scenario. A small model saves little here and chooses worse.
- **A permission mode that does not stop to ask.** A prompt nobody answers stalls the run until someone opens it. Either pick a mode that does not ask for the tools this skill uses, or add allow rules for them in `~/.claude/settings.json`: the affirun MCP tools, the shell (`node`, `curl`, `ffmpeg`, `ego-browser`, `cat`, `ls`, `mkdir`, `sleep`), file writes under `~/.config/affirun`, and the browser tools.
- **Once a day, at a time the computer is awake and the browser is not in use.** A run takes 60 to 90 minutes for five topics: the finder works in the browser the whole time. Early morning before the user sits down (`0 7 * * *`) is the usual choice.

## The settings file

Optional, at `~/.config/affirun/daily-scenarios.json`. Offer to write it from what the user tells you; without it the run uses the default account profile and five topics.

```json
{
  "accounts": [
    {
      "profile": "account profile name",
      "count": 5,
      "topic": "what this account posts, in the user's words",
      "avoid": "what it never posts",
      "referenceAccounts": ["handle", "handle"]
    }
  ]
}
```

`topic` and `referenceAccounts` matter most: they are what the run screens reels against. The handles should be on the user's benchmark list, or their reels are not in the feed.

## The prompt

```
daily-scenarios 스킬로 오늘의 시나리오를 만들어 줘.
아무도 보고 있지 않으니 묻지 말고 끝까지 진행하고, 마지막에 완성된 시나리오만 보고해 줘.
찾는 에이전트의 모델은 opus.
```

Add a line such as `계정 프로필은 <이름>, 3개만.` to override the settings file for this task.

## Claude desktop app

1. Make the empty folder first if it does not exist.
2. Create the task: with the scheduled task tool when this session has one, otherwise tell the user to open Scheduled and make a new task. Instructions are the prompt above.
3. The folder, the model and the permission mode are set in the task's form, not in its file. When the tool that created the task could not set them, tell the user to open the task, press Edit, and set: Folder to the empty folder, Model to a strong one, Permission mode to one that does not ask.
4. Tell the user what the schedule does not do: tasks run only while the app is open and the computer is awake, and the browser must be open and signed in to the sites and to Affirun. A run that is still going when the next is due makes that next one skip.

## Claude Code in a terminal

`/loop 24h` followed by the prompt above, in a session started in the empty folder and left running. It lives with that session and expires after 30 days.

## The first run

Run the task once while the user watches (Run now), with `1개만.` added to the prompt. Whatever it asks permission for, they approve for the task, so later runs do not stall. It worked when a new scenario shows up in the app's scenario list and the reply names the reel it came from. Then let it run on the schedule for a few days and read the reports before trusting the picks: the screen in the skill is rules, not a track record.
