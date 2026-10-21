import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setChromiumOpenGlRenderer("swangle");
if (process.env.CLIPFORGE_BROWSER) {
  Config.setBrowserExecutable(process.env.CLIPFORGE_BROWSER);
}
