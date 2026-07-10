const express = require("express");
const router = express.Router();

const { all, get } = require("../db");

router.get("/", async (req, res) => {
  try {
    const alumni = await all(`
      SELECT
        id,
        sourceNo,
        name,
        major,
        company,
        category,
        job,
        mentoringTopic,
        gpa,
        nonCurricularCount,
        certificationCount,
        certificationsText,
        languagesText,
        comment
      FROM alumni
      ORDER BY id ASC
    `);

    const totalRow = await get(`
      SELECT COUNT(*) AS totalAlumni
      FROM alumni
    `);

    const jobGroups = await all(`
      SELECT
        job,
        COUNT(*) AS count
      FROM alumni
      WHERE job IS NOT NULL AND job != ''
      GROUP BY job
      ORDER BY count DESC, job ASC
    `);

    const categoryGroups = await all(`
      SELECT
        category,
        COUNT(*) AS count
      FROM alumni
      WHERE category IS NOT NULL AND category != ''
      GROUP BY category
      ORDER BY count DESC, category ASC
    `);

    res.json({
      schemaVersion: "sqlite-1.0",
      summary: {
        totalAlumni: totalRow?.totalAlumni || 0,
      },
      alumni,
      jobGroups,
      categoryGroups,
    });
  } catch (error) {
    console.error("GET /api/career-data 오류:", error);
    res.status(500).json({
      message: "SQLite DB에서 커리어 데이터를 불러오지 못했습니다.",
    });
  }
});

module.exports = router;