import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import {dbUpdateAIAssessment, dbAll, dbUpdateExperience} from "./db.js"
puppeteer.use(StealthPlugin())
import { Configuration, OpenAIApi } from "openai";

const tbConfiguration = new Configuration({
  apiKey: "GET YOUR OWN API KEY",
});
const tbOpenai = new OpenAIApi(tbConfiguration);
const processPage = async (page, url) => {
  await page.goto(url);
  const min = 10000;
  const max = 16000;
  const randomNumber = Math.floor(Math.random() * (max - min + 1) + min);
  await page.waitForTimeout(randomNumber);
  await page.waitForSelector('ul.pvs-list li');
  // Scrape the data
  try {
    await page.screenshot({ path: `./screenshots/${url.replace(/[^a-z0-9]/gi, '_')}.png`, fullPage: true });
    const results = await page.evaluate(() => {
      const data = [];
      const listItems = document.querySelectorAll('.pvs-list__paged-list-item.artdeco-list__item.pvs-list__item--line-separated.pvs-list__item--one-column');
      for (let i = 0; i < Math.min(5, listItems.length); i++) {
        const listItem = listItems[i];
        const jobTitleElement = listItem.querySelector('.t-bold span[aria-hidden="true"]');
        const companyAndContractTypeElement = listItem.querySelector('.t-14.t-normal span[aria-hidden="true"]');
        const datesElement = listItem.querySelectorAll('.t-14.t-normal.t-black--light span[aria-hidden="true"]')[1];
        const workDescriptionElement = listItem.querySelectorAll('.pvs-list li .t-14.t-normal.t-black span[aria-hidden="true"]')[0];
        const skillsElement = listItem.querySelectorAll('.pvs-list li .t-14.t-normal.t-black span[aria-hidden="true"]')[1];

        const jobTitle = jobTitleElement ? jobTitleElement.textContent.trim() : 'N/A';
        const companyAndContractType = companyAndContractTypeElement ? companyAndContractTypeElement.textContent.trim() : 'N/A';
        const dates = datesElement ? datesElement.textContent.trim() : 'N/A';
        const workDescription = workDescriptionElement ? workDescriptionElement.textContent.trim() : 'N/A';
        const skills = skillsElement ? skillsElement.textContent.replace('Skills:', '').trim() : 'N/A';
        data.push(`
        Job Title: ${jobTitle}
        Company/Contract Type: ${companyAndContractType}
        Dates/Location: ${dates}
        Work Description: ${workDescription}
        Skills: ${skills}
        `);
      }
      return data;
    });
    console.log(results);
    const result = await dbUpdateExperience(url, JSON.stringify(results), true)
    if (result.changes > 0) {
      console.log("Successfully updated");
    } else {
      console.log("No rows updated, check if the URL exists");
    }

  } catch (e) {
    console.log(e)
  }

  console.log(`Processing ${url}`);
};


export const processWithAI = async (
  url, data
) => {
  let promptFragment = `Look at the following linkedin experience, formatted in an array of job details:
   \`\`\`
   ${data}
   \`\`\`
   please assess this person for suitability of the following role for Frontend developer:
  \`\`\`
  Deal Breakers:
  At least two previous roles as a frontend developer or engineering role
  Must not have lots of contract experience especially in their last or current role, this will be under "Company/Employment Type" if it says "contract"
  Must live in the UK, their present role should not be in a non UK country
  Requirements:
  Working closely with the team (design, backend) to create a seamless user experience.
  Implementing ideas into functioning interfaces using HTML, CSS, and JavaScript.
  Strong indication of design and styling skill
  Consume APIs efficiently and integrate them into the frontend.
  Keep up-to-date with emerging technologies and trends in frontend development. Suggest and demonstrate how we can harness these technologies.
  Demonstrable experience working on a responsive, complex SPA
  Expert in HTML, CSS, and JavaScript/Typescript.
  Strong experience with React or similar frontend frameworks.
  Proven experience in animations using CSS or JavaScript libraries (this should automatically bump up their rating).
  Familiarity with API consumption and integration. 
  Nice to have:
  Understanding of WebGL frameworks such as Three.js.
  Interest in or knowledge of modern AI and LLMs.
  Excellent knowledge of UI/UX principles.
  \`\`\`
  Please call the candidate_review function and assess the candidate. Assess deal breakers first, if a deal breaker is met then you can return early with the deal breaker reasoning`;


  const res = await tbOpenai.createChatCompletion({
    model: "gpt-4",
    temperature: 0.6,
    messages: [
      {
        role: "system",
        content:
          "You are a helpful function runner, you should always call candidate_review",
      },
      {
        role: "user",
        content: `${promptFragment}`,
      },
    ],
    functions: [
      {
        name: "candidate_review",
        description:
          "Given the candidate's experience, assess them for suitability for the role",
        parameters: {
          type: "object",
          properties: {
            outcome: {
              type: "object",
              properties: {
                isSuitable: {
                  type: "boolean",
                  description:
                    "overall is the candidate suitable for the role",
                },
                suitabilityHeadline: {
                  type: "string",
                  description:
                    "the main or core reason, or sum of reasons for the suitability of the candidate",
                },
                rating: {
                  type: "number",
                  description:
                    "a total score out of 10",
                },
                reasoning: {
                  type: "array",
                  description:
                    "a list of justifications for the suitability of the candidate",
                  items: {
                    type: "object",
                    properties: {
                      sentiment: {
                        type: "string",
                        enum: ["positive", "negative"],
                        description:
                          "whether this particular is positive or negative for the candidate",
                      },
                      reasoning: {
                        type: "string",
                        description:
                          "explain the thing that is positive or negative for the candidate",
                      },
                    },
                  }
                },
              },
              required: ["isSuitable", "suitabilityHeadline", "reasoning", "rating"],
            },
          },
          required: ["outcome"],
          description: "",
        },
      },
    ],
  });

  let outcomes = JSON.parse(
    res.data.choices[0].message.function_call.arguments,
  );

  return outcomes;
};


const scrapeLinkedin = async (urls) => {
  puppeteer.launch({ headless: true }).then(async browser => {
    const page = await browser.newPage();

    await page.setViewport({
      width: 1448,
      height: 1140
    });

    await page.setCookie(
      { name: 'li_at', value: 'GET YOUR OWN COOKIES', domain: '.linkedin.com' },
      { name: 'li_theme_set', value: 'GET YOUR OWN COOKIES', domain: '.linkedin.com' },
      { name: 'timezone', value: 'GET YOUR OWN COOKIES', domain: '.linkedin.com' },
      { name: 'UserMatchHistory', value: 'GET YOUR OWN COOKIES', domain: '.linkedin.com' },
      { name: 'PLAY_LANG', value: 'GET YOUR OWN COOKIES', domain: '.linkedin.com' },
      { name: 'li_mc', value: 'GET YOUR OWN COOKIES', domain: '.linkedin.com' },
      { name: 'JSESSIONID', value: 'GET YOUR OWN COOKIES', domain: '.linkedin.com' },
      { name: 'liap', value: 'GET YOUR OWN COOKIES', domain: '.linkedin.com' },
      { name: 'bscookie', value: 'GET YOUR OWN COOKIES', domain: '.linkedin.com' },
      { name: 'lidc', value: 'GET YOUR OWN COOKIES', domain: '.linkedin.com' },
      { name: 'sdsc', value: 'GET YOUR OWN COOKIES', domain: '.linkedin.com' },
      { name: 'lang', value: 'GET YOUR OWN COOKIES', domain: '.linkedin.com' },
      { name: 'PLAY_SESSION', value: 'GET YOUR OWN COOKIES', domain: '.linkedin.com' },
      { name: 'li_theme', value: 'GET YOUR OWN COOKIES', domain: '.linkedin.com' },
      { name: 'bcookie', value: 'GET YOUR OWN COOKIES', domain: '.linkedin.com' }
    );



    for (const url of urls) {
      await processPage(page, url);
    }

    await browser.close();
  });
}

(async () => {
  // Do stuff here, I normally run things in three steps:
  // 1. Seed the DB with linkedin URLs in ./db.js
  // 2. Iterate through that list and scrape the data by calling scrapeLinkedin()
  // 3. Iterate through that list now with experience data from step 2 and process the data with AI by calling processWithAI()
  //
  // Step 2:
  // const results = await dbAll("SELECT * FROM candidates WHERE scraped = 0");
  // const urls = results.map(result => result.url);
  // await scrapeLinkedin(urls);

  // Step 3:
  const results = await dbAll("SELECT * FROM candidates WHERE scraped = 1");
  for (const result of results) {
    console.log(`processing ${result.url}`);
    const data = await processWithAI(result.url, result.data);
    console.log(JSON.stringify(data));
    const dbResult = await dbUpdateAIAssessment(result.url, JSON.stringify(data.outcome.reasoning), data.outcome.isSuitable, data.outcome.suitabilityHeadline, data.outcome.rating)
    if (dbResult.changes > 0) {
      console.log("Successfully updated");
    } else {
      console.log("No rows updated, check if the URL exists");
    }
  }
})();



