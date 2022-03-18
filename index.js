require('dotenv').config();
const { createHash } = require('crypto');
const { Octokit } = require('@octokit/rest');
const { user_record } = require('NeteaseCloudMusicApi');

const {
  GIST_ID: gistId,
  GH_TOKEN: githubToken,
  USER_ID: userId,
  USER_TOKEN: userToken,
  UPDATE_README: updateReadme,
  UPDATE_README_OWNER: updateReadmeOwner,
  UPDATE_README_REPO: updateReadmeRepo,
} = process.env;

const startSection = "<!-- netease-music-box start -->";
const endSection = "<!-- netease-music-box end -->"
const replaceReg = new RegExp(`${startSection}[\\s\\S]+${endSection}`, 'g');

(async () => {
  /**
   * First, get user record
   */

  const record = await user_record({
    cookie: `MUSIC_U=${userToken}`,
    uid: userId,
    type: 1, // last week
  }).catch(error => console.error(`Unable to get user record \n${error}`));

  /**
   * Second, get week play data and parse into song/plays diagram
   */

  let totalPlayCount = 0;
  const { weekData } = record.body;
  weekData.forEach(data => {
    totalPlayCount += data.playCount;
  });

  const icon = ['🥇', '🥈', '🥉', '', '']

  const lines = weekData.slice(0, 5).reduce((prev, cur, index) => {
    const playCount = cur.playCount;
    const artists = cur.song.ar.map(a => a.name);
    let name = `${cur.song.name} - ${artists.join('/')}`;

    const line = [
      icon[index].padEnd(2),
      name,
      ' · ',
      `${playCount}`,
      'plays',
    ];

    return [...prev, line.join(' ')];
  }, []).join('\n');

  /**
   * Finally, write into gist
   */

   const octokit = new Octokit({
    auth: `token ${githubToken}`,
  });

  try {
    const gist = await octokit.gists.get({
      gist_id: gistId,
    });

    const filename = Object.keys(gist.data.files)[0];
    await octokit.gists.update({
      gist_id: gistId,
      files: {
        [filename]: {
          filename: `🎵 My last week in music`,
          content: lines,
        },
      },
    });
  } catch (error) {
    console.error(`Unable to update gist\n${error}`);
  }

  if (updateReadme === 'true' && updateReadmeOwner && updateReadmeRepo) {
    const { data } = await octokit.repos.getContent({
      owner: updateReadmeOwner,
      repo: updateReadmeRepo,
      path: 'README.md',
    });

    const readme = Buffer.from(data.content, 'base64').toString();
    const new_readme = Buffer.from(readme.replace(replaceReg, `${startSection}${lines}${endSection}`)).toString('base64');
    // const hash = createHash('sha1');
    // hash.update(new_readme);
    // const sha = hash.digest('hex');

    try {
      await octokit.repos.createOrUpdateFileContents({
        owner: updateReadmeOwner,
        repo: updateReadmeRepo,
        path: 'README.md',
        message: 'Update music statistics',
        content: new_readme,
        sha: data.sha,
      })
    } catch (error) {
      console.error(`Unable to update readme\n${error}`);
    }
  }
})();
