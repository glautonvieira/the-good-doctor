/* eslint-disable no-undef */
const puppeteer = require('puppeteer');
const fs = require('fs');
const { PAGE_URL, BASE_URL } = require('./config');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

const scrape = async () => {
  const browser = await puppeteer.launch({
    headless: false,
  });

  const page = await browser.newPage();

  await page.setViewport({
    width: 1366,
    height: 768,
    deviceScaleFactor: 1,
  });

  await page.goto(PAGE_URL);

  let haveNext = false;
  let links = [];

  do {
    haveNext = false;
    const articleLink = 'article > div > a';
    const urls = await page.$$eval(articleLink, (el) =>
      el.map((a) => a.getAttribute('href')));

    links = links.concat(urls);

    const postLink = 'a > h1';
    const nextPost = await page.$(postLink);

    if (nextPost) {
      await Promise.all(
        [
          page.waitForNavigation(),
          page.$eval(postLink, (e) => e.click()),
        ],
      );
      haveNext = true;
    }
  } while (haveNext);

  const posts = [];

  for (const url of links) {
    const contentText = 'div > div.Article, article > div > div > div';
    const titleText = 'h1, article > div > div > div';
    const authorText = '.CardHeadline > div > span, article > div > div';
    const imageUrl = 'div:nth-child(1) > img, h1';

    await page.goto(BASE_URL + url, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector(contentText);

    await page.waitForSelector(titleText);
    const title = await page.$eval(titleText, (title) => title.innerText);

    await page.waitForSelector(authorText);
    const author = await page.$eval(authorText, (author) => author.innerText);

    await page.waitForSelector(imageUrl);
    const image = await page.$eval(imageUrl, (image) => image.getAttribute('src'));

    const content = await page.$eval(contentText, (el) => el.innerText);

    const post = {
      title,
      image,
      author,
      content,
    };

    posts.push(post);

    const logger = fs.createWriteStream('reports/log.txt', { flags: 'a' });
    logger.write(`${title} - ${author} - ${content} - ${image}\n`);
    logger.close();
  }
  browser.close();
  return posts;
};

scrape()
  .then((value) => {
    const date = new Date();
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    const fullDate = `${day}-${month}-${year}`;
    const csvWriter = createCsvWriter({

      path: `reports/Result-${fullDate}.csv`,
      header: [
        { id: 'title', title: 'Title' },
        { id: 'author', title: 'Author' },
        { id: 'content', title: 'Content' },
        { id: 'image', title: 'Image' },
      ],
    });
    csvWriter
      .writeRecords(value)
      .then(() => {
        console.log('...Done');
      });
  })
  .catch((error) => console.log(error));
