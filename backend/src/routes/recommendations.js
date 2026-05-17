const express = require("express");
const fs = require("fs");
const path = require("path");

const router = express.Router();

const careerDataPath = path.join(__dirname, "../../data/career-data.json");
const dbDataPath = path.join(__dirname, "../../data/db.json");

function readJsonFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  const data = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(data);
}

function normalizeArray(value) {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value
      .map((item) => String(item).trim().toLowerCase())
      .filter((item) => item.length > 0);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter((item) => item.length > 0);
  }

  return [];
}

function calculateMatchScore(userSkills, requiredSkills) {
  if (requiredSkills.length === 0) {
    return {
      matchScore: 0,
      matchedSkills: [],
      missingSkills: [],
    };
  }

  const matchedSkills = requiredSkills.filter((skill) =>
    userSkills.includes(skill)
  );

  const missingSkills = requiredSkills.filter(
    (skill) => !userSkills.includes(skill)
  );

  const matchScore = Math.round(
    (matchedSkills.length / requiredSkills.length) * 100
  );

  return {
    matchScore,
    matchedSkills,
    missingSkills,
  };
}

function getLevel(score) {
  if (score >= 80) return "매우 적합";
  if (score >= 60) return "적합";
  if (score >= 40) return "보완 필요";
  return "준비 필요";
}

function findLoginUser(dbData) {
  const users = dbData.users || [];

  return users.find((user) => user.isLoggedIn === true) || users[0] || null;
}

function getJobs(careerData) {
  if (Array.isArray(careerData)) return careerData;

  if (Array.isArray(careerData.jobs)) return careerData.jobs;
  if (Array.isArray(careerData.careers)) return careerData.careers;
  if (Array.isArray(careerData.data)) return careerData.data;

  const possibleKeys = Object.keys(careerData);

  const jobs = [];

  possibleKeys.forEach((key) => {
    const value = careerData[key];

    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (typeof item === "object" && item !== null) {
          jobs.push({
            id: item.id || `${key}-${index}`,
            name: item.name || item.jobName || item.title || key,
            ...item,
          });
        }
      });
    }

    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      jobs.push({
        id: value.id || key,
        name: value.name || value.jobName || value.title || key,
        ...value,
      });
    }
  });

  return jobs;
}

router.get("/", (req, res) => {
  try {
    const careerData = readJsonFile(careerDataPath);
    const dbData = readJsonFile(dbDataPath);

    if (!careerData) {
      return res.status(500).json({
        message: "career-data.json 파일을 찾을 수 없습니다.",
      });
    }

    if (!dbData) {
      return res.status(500).json({
        message: "db.json 파일을 찾을 수 없습니다.",
      });
    }

    const loginUser = findLoginUser(dbData);

    if (!loginUser) {
      return res.status(401).json({
        message: "추천 결과를 계산할 사용자 정보가 없습니다.",
      });
    }

    const profile = loginUser.profile || {};

    const userSkills = [
      ...normalizeArray(profile.skills),
      ...normalizeArray(profile.techStack),
      ...normalizeArray(profile.certificates),
      ...normalizeArray(profile.activities),
      ...normalizeArray(profile.experience),
      ...normalizeArray(profile.projects),
    ];

    const jobs = getJobs(careerData);

    if (jobs.length === 0) {
      return res.status(500).json({
        message: "career-data.json에서 직무 데이터를 찾을 수 없습니다.",
      });
    }

    const recommendations = jobs.map((job) => {
      const jobName = job.name || job.jobName || job.title || "직무명 없음";

      const requiredSkills = [
      ...normalizeArray(job.requiredSkills),
      ...normalizeArray(job.skills),
      ...normalizeArray(job.skill),
      ...normalizeArray(job.techStack),
      ...normalizeArray(job.stack),
      ...normalizeArray(job.quantitativeSpecs),
      ...normalizeArray(job.qualitativeSpecs),
      ...normalizeArray(job.required),
      ...normalizeArray(job.specs),
      ...normalizeArray(job.certificates),
      ...normalizeArray(job.activities),
      ...normalizeArray(job.keywords),
      ...normalizeArray(job.description),
    ];

      const result = calculateMatchScore(userSkills, requiredSkills);

      return {
        jobId: job.id || job.jobId || jobName,
        jobName,
        matchScore: result.matchScore,
        level: getLevel(result.matchScore),
        matchedSkills: result.matchedSkills,
        missingSkills: result.missingSkills,
        advice:
          result.missingSkills.length > 0
            ? `${result.missingSkills.join(
                ", "
              )} 경험을 보완하면 ${jobName} 직무 적합도가 더 높아집니다.`
            : "현재 입력된 스펙이 해당 직무와 잘 맞습니다.",
      };
    });

    recommendations.sort((a, b) => b.matchScore - a.matchScore);

    return res.json({
      user: {
        email: loginUser.email || "",
        name: loginUser.name || loginUser.username || "사용자",
      },
      recommendations,
    });
  } catch (error) {
    console.error("추천 시스템 오류:", error);

    return res.status(500).json({
      message: "추천 결과를 계산하는 중 오류가 발생했습니다.",
    });
  }
});

module.exports = router;