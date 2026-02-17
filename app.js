const button = document.getElementById("helloButton");
const message = document.getElementById("message");

button.addEventListener("click", () => {
  const timestamp = new Date().toLocaleString();
  message.textContent = `Hello from your deployed web app at ${timestamp}`;
});
