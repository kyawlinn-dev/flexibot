import express from "express";

import { handleCommand } from "../handlers/commandHandler.js";
import { handleText } from "../handlers/textHandler.js";
import { handleImage } from "../handlers/imageHandler.js";
import { logError } from "../utils/logger.js";

const router = express.Router();

router.post("/", async (req, res) => {

  const message = req.body.message;

  res.sendStatus(200);

  if (!message) {
    return;
  }

  try {

    if (message.text && message.text.startsWith("/")) {

      handleCommand(message);

    }

    else if (message.photo) {

      handleImage(message);

    }

    else if (message.text) {

      handleText(message);

    }

  }

  catch (error) {

    logError("Router error", { error: error.message });

  }

});

export default router;