/* Probe Pixelfed account statuses after cache dir fix — diagnostics only */
import { getAccountPosts } from '../../packages/pixelfed-sdk/src/index';

const TOKEN = process.env.PIXELFED_ACCESS_TOKEN;
const LOCAL = 'http://127.0.0.1:8096';

async function main() {
  for (const acctId of ['986303183066632193', '986310652953378817']) {
    try {
      const posts = await getAccountPosts(LOCAL, acctId, 40, TOKEN);
      console.log(`account ${acctId}:`, posts.length, 'posts');
      for (const p of posts.slice(0, 6))
        console.log('  -', p.id, '| media:', p.media_attachments.length, '|', p.content.slice(0, 55).replace(/<[^>]*>/g, ''));
    } catch (e) {
      console.log(`account ${acctId} ERR:`, (e as Error).message.slice(0, 200));
    }
  }
}

main();
