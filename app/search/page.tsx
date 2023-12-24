"use client";
import React, { useRef, useEffect, useState } from "react";

export default function Search() {
  const [data, setData] = useState<any>([]);
  let useEffectCalled = false;
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight - 30;
    }
  }, [data]);

  useEffect(() => {
    if (typeof window !== "undefined" && !useEffectCalled) {
      useEffectCalled = true;
      console.log("useEffectCalled", useEffectCalled);
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
                  try {
                    console.log(
                      done,
                      JSON.parse(new TextDecoder().decode(value))
                    );
                    if (
                      typeof JSON.parse(new TextDecoder().decode(value)) ===
                      "string"
                    )
                      setData((prev: any) => [
                        ...prev,
                        JSON.parse(new TextDecoder().decode(value)),
                      ]);
                  } catch (e) {
                    console.log(e);
                  }
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
    }
  }, []);

  return (
    <div className="bg-gray-900 text-white rounded-lg p-4 m-4">
      <h2 className="text-xl font-bold mb-4">Searching train</h2>
      <div
        ref={containerRef}
        className="border border-gray-600 rounded-md p-2 mb-2 min-h-32 md:min-h-48 lg:min-h-64 max-h-80 overflow-y-auto"
      >
        {data.map((item: any, index: any) => (
          <div key={index} className="font-mono py-1">
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}
