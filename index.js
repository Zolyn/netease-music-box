require('dotenv').config();
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
  LIST_LENGTH: listLength,
} = process.env;

const TITLE = '🎵 My last week in music';
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

  const { weekData } = record.body;

  const lines = weekData.slice(0, parseInt(listLength, 10) || 5).reduce((prev, cur, index) => {
    const playCount = cur.playCount;
    const artists = cur.song.ar.map(a => a.name);
    let name = `${cur.song.name} - ${artists.join('/')}`;

    const line = [
      `${index + 1}.`,
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
          filename: TITLE,
          content: lines,
        },
      },
    });
  } catch (error) {
    console.error(`Unable to update gist\n${error}`);
  }

  if (updateReadme === 'true' && updateReadmeOwner && updateReadmeRepo) {
    const gistLink = `#### <a href="https://gist.github.com/${gistId}" target="_blank">${TITLE}</a>\n`;
    const footer = `Powered by [Zolyn/netease-music-box](https://github.com/Zolyn/netease-music-box) .\n`

    const { data } = await octokit.repos.getContent({
      owner: updateReadmeOwner,
      repo: updateReadmeRepo,
      path: 'README.md',
    });

    const readme = Buffer.from(data.content, 'base64').toString();
    const matched_section = readme.match(replaceReg)[0];
    const replace_section = `${startSection}\n${gistLink}\`\`\`text\n${lines}\n\`\`\`\n${footer}${endSection}`;
    
    console.log(matched_section, replace_section);
    console.log(matched_section === replace_section)
    if (matched_section === replace_section) {
      console.log('No need to update readme');
      return;
    }

    try {
      await octokit.repos.createOrUpdateFileContents({
        owner: updateReadmeOwner,
        repo: updateReadmeRepo,
        path: 'README.md',
        message: 'Update music statistics',
        content: Buffer.from(readme.replace(replaceReg, replace_section)).toString('base64'),
        sha: data.sha,
      })
    } catch (error) {
      console.error(`Unable to update readme\n${error}`);
    }
  }
})();
