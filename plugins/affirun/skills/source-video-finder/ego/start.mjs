import { isMain, j, main, need } from './lib.mjs'

export function build(args) {
  need(args, 1, 'node start.mjs <space name> [profileId]')
  const [name, profileId] = args
  const options = profileId ? `, { profileId: ${j(profileId)} }` : ''
  return String.raw`
const task = await taskSpace(${j(name)}${options});
console.log(JSON.stringify({ spaceId: task.spaceId }));
`
}

if (isMain(import.meta.url)) main(build)
