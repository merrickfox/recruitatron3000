import sqlite3 from "sqlite3"
import fs from "fs"

let db = new sqlite3.Database('./storage/storage.db', sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
  if (err) {
    console.error('Error initializing database:', err);
  }
  initializeDatabase();
});

const initializeDatabase = () => {
  db.run("CREATE TABLE IF NOT EXISTS candidates (url TEXT, data TEXT, scraped BOOLEAN, reasoning_details TEXT, core_reasoning TEXT, is_suitable BOOLEAN, rating INT);");
};

const populateInitialData = (urls) => {
  const promises = urls.map((url) => {
    return dbRun(`INSERT INTO candidates (url, data, scraped) VALUES (?, ?, ?)`, [url, null, false]);
  });
  return Promise.all(promises);
};

export const dbRun = (sql, params) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) {
        return reject(err);
      }
      resolve(this);
    });
  });
};

export const dbAll = (sql, ...params) => {
  return new Promise((resolve, reject) => {
    db.all(sql, ...params, (err, rows) => {
      if (err) {
        return reject(err);
      }
      resolve(rows);
    });
  });
};

export const dbUpdateExperience = (url, newData, newScrapedValue) => {
  return new Promise((resolve, reject) => {
    const sql = "UPDATE candidates SET data = ?, scraped = ? WHERE url = ?";
    const params = [newData, newScrapedValue, url];

    db.run(sql, params, function (err) {
      if (err) {
        return reject(err);
      }
      resolve({ changes: this.changes });
    });
  });
};

export const dbUpdateAIAssessment = (url, reasoningDetails, isSuitable, coreReasoning, rating) => {
  return new Promise((resolve, reject) => {
    const sql = "UPDATE candidates SET reasoning_details = ?, is_suitable = ?, core_reasoning = ?, rating = ? WHERE url = ?";
    const params = [reasoningDetails, isSuitable, coreReasoning, rating, url];

    db.run(sql, params, function (err) {
      if (err) {
        return reject(err);
      }
      resolve({ changes: this.changes });
    });
  });
};

// Initialize with an array of URLs
const initialUrls = [
  "https://www.linkedin.com/in/your-mother/details/experience/",
  //... and so on, use /details/experience
];

// Run this as part of step 1.
//populateInitialData(initialUrls).catch(console.error);
