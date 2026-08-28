// Build ligero de KernelNews para Vercel.
// La app es estática (index.html) + funciones serverless en /api.
// Este script solo valida que los archivos esenciales existen.
const fs = require("fs");
const path = require("path");

const required = ["index.html", "api/content.js", "api/ping.js", "package.json"];
let ok = true;
for (const f of required) {
  if (!fs.existsSync(path.join(__dirname, "..", f))) {
    console.error("Falta archivo:", f);
    ok = false;
  }
}
if (!ok) process.exit(1);
console.log("Build OK: todas las partes de KernelNews están presentes.");
