# Run the queue on a schedule

Read this when the user asks to set the queue up as a scheduled task ("큐를 예약 작업으로 돌려줘"), not for a queue run.

## What the task must be

- **On the computer whose browser is signed in.** The finder drives that browser. A cloud routine cannot reach it or the local tools, so do not offer one.
- **A prompt that checks the queue before anything else** (below). Most runs find nothing; the check is one tool call and the run ends.
- **An empty folder of its own** (for example `~/affirun-queue`). A project folder puts that project's instructions into every call of every run, and the finder's working files (`./.source-finder/<reel code>/`) land in whatever folder the task runs in.
- **A small model for the task itself** (Haiku). The task only reads the queue and passes each reel on; the finder agent is started with a strong model of its own (`opus` unless the prompt names another).
- **A permission mode that does not stop to ask.** A prompt nobody answers stalls the run until someone opens it. Either pick a mode that does not ask for the tools this skill uses, or add allow rules for them in `~/.claude/settings.json`: the affirun MCP tools, the shell (`node`, `curl`, `ffmpeg`, `ego-browser`), and the browser tools.

## The prompt

```
어피런 원본 찾기 큐를 처리해 줘.
1. 먼저 affirun MCP 의 next_source_find_request 를 부른다. 그 전에 다른 것은 하지 않는다.
2. request 가 null 이면 "원본 찾기 큐가 비어 있어요." 한 줄만 답하고 끝낸다.
3. 릴스가 나오면 source-find-queue 스킬을 불러, 이미 받은 그 요청으로 2단계부터 이어서 한다.
찾는 에이전트의 모델은 opus.
```

Change the last line to another model alias if the user wants one.

## Claude desktop app

1. Make the empty folder first if it does not exist.
2. Create the task: with the scheduled task tool when this session has one, otherwise tell the user to open Scheduled and make a new task. Instructions are the prompt above. Ask how often if the user did not say; a few times a day is plenty (`0 9,14,20 * * *`), since each run takes every waiting reel in turn, and the user can also press Run now right after queueing.
3. The folder, the model and the permission mode are set in the task's form, not in its file. When the tool that created the task could not set them, tell the user to open the task, press Edit, and set: Folder to the empty folder, Model to Haiku, Permission mode to one that does not ask.
4. Tell the user what the schedule does not do: tasks run only while the app is open and the computer is awake, and a run that is still going when the next is due makes that next one skip.

## Claude Code in a terminal

`/loop 3h` followed by the prompt above, in a session started in the empty folder with a small model (`claude --model haiku`) and left running. It lives with that session and expires after 30 days.

## The first run

Have the user queue one reel in the app, then run the task once while they watch (Run now). Whatever it asks permission for, they approve for the task, so later runs do not stall. It worked when the reel leaves "찾을 릴스" and shows up as a session below it.
