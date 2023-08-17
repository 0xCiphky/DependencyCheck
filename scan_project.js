const fs = require("fs");
const path = require("path");
const semver = require("semver");

// Paths
const scannerDir = path.dirname(__filename);
const vulnerabilitiesPath = path.join(scannerDir, "vulnerabilities.json");
const packageJsonPath = path.join(scannerDir, "..", "package.json");
const reportPath = path.join(scannerDir, "dependency_report.md");

// Check if package.json exists
if (!fs.existsSync(packageJsonPath)) {
  console.error(
    "package.json not found in the parent directory of the scanner."
  );
  process.exit(1);
}

// Read package.json and vulnerabilities.json
const packageData = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
const vulnerabilities = JSON.parse(
  fs.readFileSync(vulnerabilitiesPath, "utf8")
);

// Combine dependencies and devDependencies
const allDependencies = {
  ...packageData.dependencies,
  ...packageData.devDependencies,
};

// Check for vulnerable dependencies and significant changes
const vulnerableDependencies = [];
const significantChanges = [];

for (let dep in allDependencies) {
  if (vulnerabilities[dep]) {
    for (let record of vulnerabilities[dep]) {
      // Vulnerability check
      if (record.type === "vulnerability") {
        for (let range of record.vulnerable_versions) {
          if (semver.intersects(allDependencies[dep], range)) {
            vulnerableDependencies.push({
              name: dep,
              version: allDependencies[dep],
              description: record.description,
              patched_versions: record.patched_versions,
              link: record.link,
            });
            break;
          }
        }
      }

      // Release check
      if (record.type === "release") {
        for (let versionRange of record.version) {
          if (semver.intersects(allDependencies[dep], versionRange)) {
            significantChanges.push({
              name: dep,
              version: allDependencies[dep],
              description: record.description,
              link: record.link,
            });
            break; // exit the loop once a match is found
          }
        }
      }
    }
  }
}

// Generate markdown report
let report = "# Dependency Scan Report\n\n";

// Summary Section
const currentDate = new Date().toLocaleDateString();
report += `**Scan Date**: ${currentDate}\n\n`;
report += `**Total Dependencies Checked**: ${
  Object.keys(allDependencies).length
}\n\n`;
report += `**Known Issues In Current Dependencies**: ${vulnerableDependencies.length}\n\n`;

// Table Format for All Dependencies
report += "\n\n## All Dependencies\n\n";
report += "<details>\n<summary>All Dependencies</summary>\n\n";
report += "| Dependency | Version |\n";
report += "|------------|---------|\n";
for (let dep in allDependencies) {
  report += `| ${dep} | ${allDependencies[dep]} |\n`;
}
report += "</details>\n\n";

// Generate a section with the provided title and data
function generateSection(title, data) {
  if (data.length > 0) {
    report += `\n\n## ${title}:\n\n`;
    report += "<details>\n<summary>" + title + "</summary>\n\n";
    report +=
      "| Dependency | Version | Description | Patched Versions | Link |\n";
    report +=
      "|------------|---------|-------------|------------------|------|\n";
    for (let item of data) {
      report += `| ${item.name} | ${item.version} | ${item.description} | ${item.patched_versions} | [Details](${item.link}) |\n`;
    }
    report += "</details>\n\n";
  }
}

// Generate sections for Known Issues and Significant Changes
generateSection("Known Issues In Dependencies", vulnerableDependencies);
generateSection("Significant Changes In Dependencies", significantChanges);

fs.writeFileSync(reportPath, report);
console.log("Dependency report generated at:", reportPath);
