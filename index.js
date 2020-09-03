require("dotenv").config();
const express = require("express");
const sharp = require("sharp");
const { default: signed } = require("signed");
const path = require("path");
const fs = require("fs");
const Joi = require("@hapi/joi");
const validator = require("express-joi-validation").createValidator({});

const app = express();
if (process.env.NODE_ENV == "production") {
  app.use(
    signed({ secret: process.env.SECRET }).verifier({
      blackholed: (req, res, next) => {
        res.status(400).send("Invalid signature");
      },
    })
  );
}

async function isFileValid(fullPath) {
  if (fullPath.indexOf("\0") !== -1) return false;
  if (!fullPath.startsWith(process.env.ROOT_DIR)) return false;
  try {
    await fs.promises.stat(fullPath);
  } catch (err) {
    return false;
  }
  return true;
}

function setHeaders(res) {
  return function (info) {
    res.set("Content-Type", `image/${info.format}`);
    res.set("Cache-Control", "public, max-age=31536000");
  };
}

const imageSchema = Joi.object({
  w: Joi.number().min(10).max(2000).default(500),
  h: Joi.number().min(10).max(2000),
  f: Joi.string().allow("webp", "jpeg"),
});

app.get(
  "/image/:relativePath",
  validator.query(imageSchema),
  async (req, res) => {
    // https://nodejs.org/en/knowledge/file-system/security/introduction/
    const relativePath = (req.params.relativePath ?? "").toString();
    const fullPath = path.join(process.env.ROOT_DIR, relativePath);
    const isValid = await isFileValid(fullPath);
    if (!isValid) {
      return res.status(400).send("Bad path");
    }

    let { w, h, f } = req.query;
    if (f == null) {
      if (req.accepts("image/webp")) f = "webp";
      else f = "jpeg";
    }

    const readableStream = fs.createReadStream(fullPath);
    const transformStream = sharp({ sequentialRead: true })
      .trim()
      .resize(w, h, {
        withoutEnlargement: true,
        position: sharp.strategy.attention,
      })
      .normalise()
      .on("info", setHeaders(res));

    if (f == "webp") {
      transformStream.webp();
    } else {
      transformStream.jpeg({
        progressive: true,
        optimiseScans: true,
        trellisQuantisation: true,
        overshootDeringing: true,
      });
    }

    readableStream.pipe(transformStream).pipe(res);
  }
);

const placeholderSchema = Joi.object({
  w: Joi.number().min(5).max(100).default(42),
  h: Joi.number().min(5).max(100).default(42),
  f: Joi.string().allow("webp", "jpeg"),
});

app.get(
  "/preview/:relativePath",
  validator.query(placeholderSchema),
  async (req, res) => {
    // https://nodejs.org/en/knowledge/file-system/security/introduction/
    const relativePath = (req.params.relativePath ?? "").toString();
    const fullPath = path.join(process.env.ROOT_DIR, relativePath);
    const isValid = await isFileValid(fullPath);
    if (!isValid) {
      return res.status(400).send("Bad path");
    }

    let { w, h, f } = req.query;
    if (f == null) {
      if (req.accepts("image/webp")) f = "webp";
      else f = "jpeg";
    }

    const readableStream = fs.createReadStream(fullPath);
    const transformStream = sharp({ sequentialRead: true })
      .trim()
      .resize(w, h, {
        withoutEnlargement: true,
        position: sharp.strategy.attention,
      })
      .blur()
      .normalise()
      .on("info", setHeaders(res));

    if (f == "webp") {
      transformStream.webp({ quality: 12 });
    } else {
      transformStream.jpeg({
        quality: 12,
        trellisQuantisation: true,
        overshootDeringing: true,
      });
    }

    readableStream.pipe(transformStream).pipe(res);
  }
);

app.listen(process.env.PORT, () => {
  console.log(`🚀 Server listening on *:${process.env.PORT}`);
});
