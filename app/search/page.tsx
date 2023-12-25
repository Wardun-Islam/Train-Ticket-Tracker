"use client";
import React, { useRef, useEffect, useState } from "react";
import StationDistanceTable from "./components/table";

export default function Search() {
  const [data, setData] = useState<any>([]);
  const [trainName, setTrainName] = useState<any>([]);
  const [distanceData, setDistanceData] = useState<any>([]);
  const [stations, setStations] = useState<any>([]);
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
                    controller.close();
                    return;
                  }
                  // Get the data and send it to the browser via the controller
                  controller.enqueue(value);
                  // Check chunks by logging to the console
                  try {
                    const value1 = JSON.parse(new TextDecoder().decode(value));

                    if (value1.train_name) {
                      setTrainName((prev: any) => [...prev, value1.train_name]);
                    } else if (value1.station_list) {
                      setStations((prev: any) => [
                        ...prev,
                        value1.station_list,
                      ]);
                    } else if (value1.seat_data) {
                      setDistanceData((prev: any) => {
                        const updatedData = [...prev];
                        const updatedData1 = {
                          ...updatedData[updatedData.length - 1],
                        };
                        updatedData1[value1.seat_data.station1] =
                          updatedData1[value1.seat_data.station1] || {};
                        updatedData1[value1.seat_data.station1][
                          value1.seat_data.station2
                        ] = value1.seat_data.available_seat;
                        if (updatedData.length > 0) {
                          updatedData[updatedData.length - 1] = updatedData1;
                        } else {
                          updatedData.push(updatedData1);
                        }
                        return updatedData;
                      });
                    } else {
                      setData((prev: any) => [...prev, value1]);
                    }
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
    <div className="container mx-auto p-4">
      <div className="bg-gray-900 text-white rounded-lg p-4 m-4">
        <h2 className="text-xl font-bold mb-4">
          {trainName.length > 0
            ? `Searching train ${trainName[trainName.length - 1]}`
            : "Initializing search..."}
        </h2>
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

      {stations.length > 0 &&
        stations.map((item: any, index: any) => (
          <div
            key={index}
            className="bg-gray-900 text-white rounded-lg p-4 m-4"
          >
            <h2 className="text-xl font-bold mb-4">{`${trainName[index]} Stations`}</h2>
            <div className="border border-gray-600 rounded-md p-2 mb-2 overflow-x-auto">
              <StationDistanceTable
                stations={item}
                distanceData={distanceData[index] ? distanceData[index] : {}}
              />
            </div>
          </div>
        ))}
    </div>
  );
}
