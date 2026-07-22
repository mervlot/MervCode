// convert-icons.js
import fs from "fs";
import path from "path";

// 1. Read the uploaded file
const data = JSON.parse(fs.readFileSync("icon.json", "utf8"));
const defs = data.iconDefinitions;

const updatedDefinitions = {};

// 2. Map and restructure each definition dynamically
for (const [key, val] of Object.entries(defs)) {
  const iconPath = val.iconPath;
  const filename = path.basename(iconPath); // e.g., "yaml.svg", "image.svg"

  // Determine the viewer type by inspecting the icon svg filename
  let viewer = "editor";
  if (
    filename.includes("image") ||
    filename.includes("photo") ||
    filename.includes("palette")
  ) {
    viewer = "image";
  } else if (filename.includes("video")) {
    viewer = "video";
  } else if (filename.includes("pdf")) {
    viewer = "pdf";
  } else if (filename.includes("table") || filename.includes("excel")) {
    viewer = "spreadsheet";
  }

  // Assign the new restructured object format
  updatedDefinitions[key] = {
    iconPath: iconPath,
    viewer: viewer,
  };
}

// 3. Write it back nicely formatted
data.iconDefinitions = updatedDefinitions;
fs.writeFileSync("icon.json", JSON.stringify(data, null, 2), "utf8");

console.log("Successfully updated icon definitions format inside icon.json!");
