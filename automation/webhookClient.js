import axios from "axios";

export async function emit(event) {
  await axios.post(process.env.EVENT_URL, event, {
    headers: {
      Authorization: `Bearer ${process.env.WEBHOOK_SECRET}`,
      "Content-Type": "application/json",
    },
  });
}
