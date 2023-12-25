"use client";
import React, { useRef, useEffect, useState } from "react";

const StationDistanceTable = ({ stations, distanceData }: any) => {
  return (
    <div className="overflow-x-auto">
      <table className="table-auto border-collapse border border-gray-400">
        <thead>
          <tr>
            <th className="border border-gray-400 p-2"></th>
            {stations.toReversed().map((station: any) => (
              <th key={station} className="border border-gray-400 p-2">
                {station.replace(/_/g, " ")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {stations.map((station1: any) => (
            <tr key={station1}>
              <th className="border border-gray-400 p-2">
                {station1.replace(/_/g, " ")}
              </th>
              {stations.toReversed().map((station2: any) => {
                const availableSeats = distanceData[station1]?.[station2];

                // Check if seats data is available
                const displaySeats = availableSeats
                  ? Object.entries(availableSeats).map(
                      ([seatClass, count]: any) =>
                        count !== 0 && (
                          <div key={seatClass}>
                            <strong>{seatClass}: </strong>
                            {count}
                          </div>
                        )
                    )
                  : "-";

                return (
                  <td key={station2} className="border border-gray-400 p-2">
                    {displaySeats}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// const StationDistancePage = () => {
//   const unidirectionalDistanceData = {
//     'Station A': { 'Station B': 10, 'Station C': 20, 'Station D': 15 },
//     'Station B': { 'Station C': 25, 'Station D': 30 },
//     'Station C': { 'Station D': 18 },
//     'Station D': {},
//   };

//   return (
//     <div className="container mx-auto p-4">
//       <h2 className="text-xl font-bold mb-4">Station Distance Table</h2>
//       <StationDistanceTable distanceData={unidirectionalDistanceData} />
//     </div>
//   );
// };

export default StationDistanceTable;
