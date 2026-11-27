/* Тед (уеб): работникът прави програмата инсталируема от Google Chrome и я пуска и при слаба връзка. */
if ("serviceWorker" in navigator) addEventListener("load", function () { navigator.serviceWorker.register("sw.js", { scope: "./" }).catch(function () {}); });
