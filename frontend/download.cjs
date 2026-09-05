const https = require('https');
const fs = require('fs');

const download = (url, dest) => {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Handle redirect for picsum
        download(response.headers.location, dest).then(resolve).catch(reject);
      } else {
        const file = fs.createWriteStream(dest);
        response.pipe(file);
        file.on('finish', () => {
          file.close(resolve);
        });
      }
    }).on('error', (err) => {
      fs.unlink(dest, () => reject(err));
    });
  });
};

(async () => {
  try {
    for (let i = 1; i <= 5; i++) {
      console.log(`Downloading image ${i}...`);
      await download(`https://picsum.photos/seed/road${i}/1200/800`, `public/images/road${i}.jpg`);
    }
    console.log("Done");
  } catch (e) {
    console.error(e);
  }
})();
