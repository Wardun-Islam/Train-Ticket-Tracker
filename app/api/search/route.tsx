import cheerio from "cheerio";
import axios from "axios";
import { MongoClient, ServerApiVersion } from "mongodb";
import { cities } from "../../constants/constants";

const uri = process.env.MONGODB_URL || "";
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

function extractDigitsAsNumber(str: string) {
  const digitArray = str.match(/\d/g); // Match all digits in the string
  if (digitArray) {
    const number = parseInt(digitArray.join(""), 10); // Join digits and convert to number
    return number;
  }
  return null; // Return null if there are no digits in the string
}

function addOneDayToDate(dateString: string) {
  const [day, month, year] = dateString.split("-");
  const incrementedDay = parseInt(day, 10) + 1;

  // Format the day with leading zeros if necessary
  const newDay = incrementedDay.toString().padStart(2, "0");

  return `${newDay}-${month}-${year}`;
}

function isAM(timeString: string) {
  const lowerCaseString = timeString.toLowerCase();

  if (lowerCaseString.includes("am")) {
    return true;
  }
  return false;
}

function generatePairs(arr: { station_name: string; station_date: string }[]) {
  const pairs = [];

  for (let i = 0; i < arr.length; i++) {
    for (let j = i + 1; j < arr.length; j++) {
      pairs.push({
        fromcity: arr[i].station_name,
        tocity: arr[j].station_name,
        doj: arr[i].station_date,
        available_seat: { s_chair: 0, ac_b: 0, ac_s: 0, snigdha: 0 },
      });
    }
  }

  return pairs;
}

const validateCity = (cityName: string) => {
  var filteredCity = cities.filter(function (city: any) {
    return (
      city.city_name === cityName &&
      city.is_enable_for_from == 1 &&
      city.is_enable_for_web == 1
    );
  });
  return filteredCity.length ? true : false;
};

// https://developer.mozilla.org/docs/Web/API/ReadableStream#convert_async_iterator_to_stream
function getStream(request: Request) {
  return new ReadableStream({
    async pull(controller) {
      // Create an instance of axios
      const instance = axios.create({
        baseURL: "https://eticket.railway.gov.bd", // Set your base URL
        withCredentials: true,
      });

      // Function to handle requests with session-like behavior
      async function makeSessionRequest(url: string) {
        const maxRetries = 1000; // Maximum number of retries
        let retries = 0;

        while (retries < maxRetries) {
          try {
            console.log(`Requesting ${url}...`);
            const response = await instance.get(url);

            const receivedCookies = response.headers["set-cookie"];
            if (receivedCookies) {
              instance.defaults.headers.Cookie = receivedCookies[0];
            }
            if (response && response.status === 200) {
              return response;
            } else if (response && response.status === 500) {
              console.log(`Retrying (${retries + 1}/${maxRetries})...`);
              // wait 1 second before retrying
              await new Promise((resolve) => setTimeout(resolve, 3000));
              retries++;
            }
          } catch (error: any) {
            if (error.response && error.response.status === 500) {
              console.log(`Retrying (${retries + 1}/${maxRetries})...`);
              await new Promise((resolve) => setTimeout(resolve, 3000));
              retries++;
            } else {
              // If it's not a 500 error, throw the error immediately
              throw error;
            }
          }
        }
      }
      try {
        await client.connect();
        const database = client.db("trains");
        const collection = database.collection("train_informations");
        console.log("Connected to database");

        const { fromcity, tocity, doj } = await request.json();
        const available_train_list: any = [];

        const train_info_path = `/booking/train/search/en?fromcity=${fromcity}&tocity=${tocity}&doj=${doj}&class=S_CHAIR`;
        await makeSessionRequest(train_info_path)
          .then(async (response: any) => {
            const html = response.data;
            const $ = cheerio.load(html);
            const search_id_element: any = $("#www-search-id").first();
            const search_id = search_id_element.val();

            const available_train_url_path =
              "/booking/train/search/results/0/" +
              search_id +
              "/en?seat_type=7";

            await makeSessionRequest(available_train_url_path)
              .then(async (response: any) => {
                const available_train_html = response.data;
                const available_train_$ = cheerio.load(available_train_html);

                const available_train_element: any = available_train_$(
                  ".single-trip-wrapper"
                );

                for (let i = 0; i < available_train_element.length; i++) {
                  const train = available_train_element[i];
                  const train_name = available_train_$(train)
                    .find("h2")
                    .first()
                    .text();
                  const train_id = extractDigitsAsNumber(train_name);
                  available_train_list.push({ train_name, train_id });
                  controller.enqueue(
                    JSON.stringify({ train_name: train_name })
                  );

                  const query = { name: train_name };
                  const result = await collection.findOne(query);

                  console.log(result);

                  if (result) {
                    console.log("Found in database");
                    const station_name_list = result.stationList;
                    controller.enqueue(
                      JSON.stringify({
                        station_list: station_name_list,
                      })
                    );
                    const station_pairs = result.stationPairs;
                    console.log(station_pairs);
                    for (let k = 0; k < station_pairs.length; k++) {
                      const station_pair = station_pairs[k];
                      if (!validateCity(station_pair.fromCity)) {
                        continue;
                      }
                      await makeSessionRequest(
                        `/booking/train/search/en?fromcity=${station_pair.fromCity.trim()}&tocity=${station_pair.toCity.trim()}&doj=${
                          station_pair.nextDay ? addOneDayToDate(doj) : doj
                        }&class=S_CHAIR`
                      )
                        .then(async (response: any) => {
                          // const spinner = ["-", "\\", "|", "/"];
                          // const index = k % 4;
                          // clear the current line
                          // process.stdout.clearLine(0);
                          // process.stdout.write(
                          //   `\r${spinner[index]} Searching for ${station_pair.fromcity} to ${station_pair.tocity} on ${station_pair.doj} in ${train_name}`
                          // );
                          // console.log(
                          //   `\r${spinner[index]} Searching for ${station_pair.fromcity} to ${station_pair.tocity} on ${station_pair.doj} in ${train_name}`
                          // );
                          controller.enqueue(
                            JSON.stringify(
                              `✓ Searching for ${station_pair.fromCity} to ${
                                station_pair.toCity
                              } on ${
                                station_pair.nextDay
                                  ? addOneDayToDate(doj)
                                  : doj
                              } in ${train_name}`
                            )
                          );
                          const available_train_html = response.data;
                          const available_train_$ =
                            cheerio.load(available_train_html);
                          const search_id_element =
                            available_train_$(`#www-search-id`).first();
                          const search_id = search_id_element.val();
                          const available_train_url_path = `/booking/train/search/results/0/${search_id}/en?seat_type=7`;
                          await makeSessionRequest(available_train_url_path)
                            .then((response: any) => {
                              const available_train_html = response.data;
                              const available_train_$ =
                                cheerio.load(available_train_html);
                              const available_train_element: any =
                                available_train_$(`.single-trip-wrapper`);
                              for (
                                let l = 0;
                                l < available_train_element.length;
                                l++
                              ) {
                                const train_name2 = available_train_$(
                                  available_train_element[l]
                                )
                                  .find("h2")
                                  .text();
                                const train_id2 =
                                  extractDigitsAsNumber(train_name2);
                                if (train_id === train_id2) {
                                  const seat_class_elements = available_train_$(
                                    available_train_element[l]
                                  ).find(".single-seat-class");
                                  for (
                                    let m = 0;
                                    m < seat_class_elements.length;
                                    m++
                                  ) {
                                    const seat_class = available_train_$(
                                      seat_class_elements[m]
                                    )
                                      .find(".seat-class-name")
                                      .text();
                                    const seat_available = available_train_$(
                                      seat_class_elements[m]
                                    )
                                      .find(".all-seats")
                                      .text();

                                    if (
                                      station_pairs[k]["available_seat"] ===
                                      undefined
                                    ) {
                                      station_pairs[k]["available_seat"] = {};
                                    }

                                    if (seat_class === "AC_S") {
                                      station_pairs[k]["available_seat"][
                                        "ac_s"
                                      ] = parseInt(seat_available, 10);
                                    } else if (seat_class === "AC_B") {
                                      station_pairs[k]["available_seat"][
                                        "ac_b"
                                      ] = parseInt(seat_available, 10);
                                    } else if (seat_class === "SNIGDHA") {
                                      station_pairs[k]["available_seat"][
                                        "snigdha"
                                      ] = parseInt(seat_available, 10);
                                    } else if (seat_class === "S_CHAIR") {
                                      station_pairs[k]["available_seat"][
                                        "s_chair"
                                      ] = parseInt(seat_available, 10);
                                    }
                                  }
                                  controller.enqueue(
                                    JSON.stringify({
                                      seat_data: {
                                        station1: station_pair.fromCity.trim(),
                                        station2: station_pair.toCity.trim(),
                                        available_seat:
                                          station_pair.available_seat,
                                      },
                                    })
                                  );
                                }
                              }
                            })
                            .catch((error) => {
                              controller.close();
                              console.error("Error fetching data:", error);
                            });
                        })
                        .catch((error) => {
                          controller.close();
                          console.error("Error fetching data:", error);
                        });
                    }
                    available_train_list[i].station_pairs = station_pairs;
                  } else {
                    console.log("Not found in database");
                    // insert the document
                    const doc = { name: train_name, id: train_id };
                    const result = await collection.insertOne(doc);
                    console.log(
                      `${result} documents were inserted with the _id: ${result.insertedId}`
                    );
                    await makeSessionRequest(
                      "/booking/trip/" + train_id + "/details"
                    )
                      .then(async (response: any) => {
                        const train_details_html = response.data;
                        const train_details_$ =
                          cheerio.load(train_details_html);

                        const train_station_name_element: any = train_details_$(
                          ".route-station-name"
                        );

                        const train_station_time_element: any = train_details_$(
                          ".route-other-info ul li:nth-child(3) span:nth-child(2)"
                        );

                        const station_list = [];
                        const station_list_for_db = [];
                        let addOneDay = false;

                        for (
                          let j = 0;
                          j < train_station_name_element.length;
                          j++
                        ) {
                          const station_name =
                            train_station_name_element[j].children[0].data;
                          const station_time =
                            train_station_time_element[j].children[0].data;

                          let previous_station_time = null;
                          if (j > 0) {
                            previous_station_time =
                              train_station_time_element[j - 1].children[0]
                                .data;
                          }
                          let station_date = doj;
                          if (
                            station_time !== null &&
                            previous_station_time !== null &&
                            isAM(station_time) &&
                            !isAM(previous_station_time)
                          ) {
                            addOneDay = true;
                          }
                          if (addOneDay) {
                            station_date = addOneDayToDate(station_date);
                          }
                          station_list.push({ station_name, station_date });
                          station_list_for_db.push(station_name.trim());
                        }
                        available_train_list[i].station_list = station_list;
                        // insert the document
                        const filter = { name: train_name };
                        const updateDoc = {
                          $set: { stationList: station_list_for_db },
                        };

                        const result = await collection.updateOne(
                          filter,
                          updateDoc
                        );

                        console.log(
                          `${result.matchedCount} documents matched the filter, updated ${result.modifiedCount} documents`
                        );

                        const station_name_list = station_list.map(
                          (station: any) => station.station_name
                        );
                        controller.enqueue(
                          JSON.stringify({ station_list: station_name_list })
                        );
                        const station_pairs = generatePairs(station_list);
                        const station_pairs_for_db: any = [];
                        for (let k = 0; k < station_pairs.length; k++) {
                          const station_pair = station_pairs[k];
                          if (!validateCity(station_pair.fromcity)) {
                            continue;
                          }
                          await makeSessionRequest(
                            `/booking/train/search/en?fromcity=${station_pair.fromcity.trim()}&tocity=${station_pair.tocity.trim()}&doj=${
                              station_pair.doj
                            }&class=S_CHAIR`
                          )
                            .then(async (response: any) => {
                              // const spinner = ["-", "\\", "|", "/"];
                              // const index = k % 4;
                              // clear the current line
                              // process.stdout.clearLine(0);
                              // process.stdout.write(
                              //   `\r${spinner[index]} Searching for ${station_pair.fromcity} to ${station_pair.tocity} on ${station_pair.doj} in ${train_name}`
                              // );
                              // console.log(
                              //   `\r${spinner[index]} Searching for ${station_pair.fromcity} to ${station_pair.tocity} on ${station_pair.doj} in ${train_name}`
                              // );
                              controller.enqueue(
                                JSON.stringify(
                                  `✓ Searching for ${station_pair.fromcity} to ${station_pair.tocity} on ${station_pair.doj} in ${train_name}`
                                )
                              );
                              const available_train_html = response.data;
                              const available_train_$ =
                                cheerio.load(available_train_html);
                              const search_id_element =
                                available_train_$(`#www-search-id`).first();
                              const search_id = search_id_element.val();
                              const available_train_url_path = `/booking/train/search/results/0/${search_id}/en?seat_type=7`;
                              await makeSessionRequest(available_train_url_path)
                                .then((response: any) => {
                                  const available_train_html = response.data;
                                  const available_train_$ =
                                    cheerio.load(available_train_html);
                                  const available_train_element: any =
                                    available_train_$(`.single-trip-wrapper`);
                                  for (
                                    let l = 0;
                                    l < available_train_element.length;
                                    l++
                                  ) {
                                    const train_name2 = available_train_$(
                                      available_train_element[l]
                                    )
                                      .find("h2")
                                      .text();
                                    const train_id2 =
                                      extractDigitsAsNumber(train_name2);
                                    if (train_id === train_id2) {
                                      const seat_class_elements =
                                        available_train_$(
                                          available_train_element[l]
                                        ).find(".single-seat-class");
                                      station_pairs_for_db.push({
                                        fromCity: station_pair.fromcity,
                                        toCity: station_pair.tocity,
                                        nextDay: station_pair.doj !== doj,
                                      });
                                      for (
                                        let m = 0;
                                        m < seat_class_elements.length;
                                        m++
                                      ) {
                                        const seat_class = available_train_$(
                                          seat_class_elements[m]
                                        )
                                          .find(".seat-class-name")
                                          .text();
                                        const seat_available =
                                          available_train_$(
                                            seat_class_elements[m]
                                          )
                                            .find(".all-seats")
                                            .text();
                                        if (seat_class === "AC_S") {
                                          station_pairs[k].available_seat.ac_s =
                                            parseInt(seat_available, 10);
                                        } else if (seat_class === "AC_B") {
                                          station_pairs[k].available_seat.ac_b =
                                            parseInt(seat_available, 10);
                                        } else if (seat_class === "SNIGDHA") {
                                          station_pairs[
                                            k
                                          ].available_seat.snigdha = parseInt(
                                            seat_available,
                                            10
                                          );
                                        } else if (seat_class === "S_CHAIR") {
                                          station_pairs[
                                            k
                                          ].available_seat.s_chair = parseInt(
                                            seat_available,
                                            10
                                          );
                                        }
                                      }
                                      controller.enqueue(
                                        JSON.stringify({
                                          seat_data: {
                                            station1:
                                              station_pair.fromcity.trim(),
                                            station2:
                                              station_pair.tocity.trim(),
                                            available_seat:
                                              station_pair.available_seat,
                                          },
                                        })
                                      );
                                    }
                                  }
                                })
                                .catch((error) => {
                                  controller.close();
                                  console.error("Error fetching data:", error);
                                });
                            })
                            .catch((error) => {
                              controller.close();
                              console.error("Error fetching data:", error);
                            });
                        }
                        const updateStationPair = {
                          $set: { stationPairs: station_pairs_for_db },
                        };

                        const result_station_pair = await collection.updateOne(
                          filter,
                          updateStationPair
                        );

                        console.log(
                          `${result_station_pair.matchedCount} documents matched the filter, updated ${result_station_pair.modifiedCount} documents`
                        );
                        available_train_list[i].station_pairs = station_pairs;
                      })
                      .catch((error) => {
                        controller.close();
                        console.error("Error fetching data:", error);
                      });
                  }
                }
              })
              .catch((error) => {
                controller.close();
                console.error("Error fetching data:", error);
              });
            // controller.enqueue(json(available_train_list));
            controller.close();
          })
          .catch((error) => {
            controller.close();
            console.error("Error fetching data 1:", error);
          });
      } catch (err) {
        console.error(err);
        controller.close();
      } finally {
        await client.close();
      }
    },
  });
}

export async function POST(request: Request) {
  const stream = getStream(request);

  return new Response(stream);
}
