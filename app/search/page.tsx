"use client";
import React, { use, useEffect, useState } from "react";

export default function Search() {
  const [message, setMessage] = useState("");
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromcity = params.get("fromcity");
    const tocity = params.get("tocity");
    const doj = params.get("doj");
    fetch("/api/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fromcity: fromcity,
        tocity: tocity,
        doj: doj,
      }),
    })
      .then((response) => response.body)
      .then((rb: any) => {
        const reader = rb.getReader();

        return new ReadableStream({
          start(controller) {
            // The following function handles each data chunk
            function push() {
              // "done" is a Boolean and value a "Uint8Array"
              reader.read().then(({ done, value }: any) => {
                // If there is no more data to read
                if (done) {
                  console.log("done", done);
                  controller.close();
                  return;
                }
                // Get the data and send it to the browser via the controller
                controller.enqueue(value);
                // Check chunks by logging to the console
                console.log(done, JSON.parse(new TextDecoder().decode(value)));
                if (
                  typeof JSON.parse(new TextDecoder().decode(value)) ===
                  "string"
                )
                  setMessage(JSON.parse(new TextDecoder().decode(value)));
                push();
              });
            }
            push();
          },
        });
      })
      .then((stream) =>
        // Respond with our stream
        new Response(stream, {
          headers: { "Content-Type": "text/html" },
        }).text()
      )
      .then((result) => {
        // Do things with result
        console.log(result);
      })
      .catch((error) => {
        console.log(error);
      });
  }, []);
  return <div>{message}</div>;
}
