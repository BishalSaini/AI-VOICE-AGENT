import axios from "axios";

export const getToken = async () => {
  try {
    // Calls the Next.js API route /api/getToken
    const res = await axios.get("/api/getToken"); 
    return res.data; // { token: "..." }
  } catch (err) {
    console.error("Error fetching token:", err);
    return { token: null };
  }
};