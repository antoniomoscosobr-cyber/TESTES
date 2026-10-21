import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setChromiumOpenGlRenderer(process.env.CLIPFORGE_GL ? (process.env.CLIPFORGE_GL as "swangle") : process.platform === "linux" ? "swangle" : "angle");
if (process.env.CLIPFORGE_BROWSER) {
  Config.setBrowserExecutable(process.env.CLIPFORGE_BROWSER);
}
