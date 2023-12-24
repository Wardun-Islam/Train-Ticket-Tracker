import cheerio from "cheerio";
import axios from "axios";
import { json } from "stream/consumers";

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

// https://developer.mozilla.org/docs/Web/API/ReadableStream#convert_async_iterator_to_stream
function getStream(request: Request) {
  return new ReadableStream({
    async pull(controller) {
      const { fromcity, tocity, doj } = await request.json();
      const available_train_list: any = [];

      // Create an instance of axios
      const instance = axios.create({
        baseURL: "https://eticket.railway.gov.bd", // Set your base URL
        withCredentials: true,
      });

      let setCookies = false;

      // Function to handle requests with session-like behavior
      async function makeSessionRequest(url: string) {
        try {
          const response = await instance.get(url);

          const receivedCookies = response.headers["set-cookie"];
          if (receivedCookies && !setCookies) {
            instance.defaults.headers.Cookie = receivedCookies[0];
            setCookies = true;
          }
          return response;
        } catch (error) {
          console.error("Error:", error);
        }
      }

      const train_info_path = `/booking/train/search/en?fromcity=${fromcity}&tocity=${tocity}&doj=${doj}&class=S_CHAIR`;
      await makeSessionRequest(train_info_path)
        .then(async (response: any) => {
          const html = response.data;
          const $ = cheerio.load(html);
          const search_id_element: any = $("#www-search-id").first();
          const search_id = search_id_element.val();

          const available_train_url_path =
            "/booking/train/search/results/0/" + search_id + "/en?seat_type=7";

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

                await makeSessionRequest(
                  "/booking/trip/" + train_id + "/details"
                )
                  .then(async (response: any) => {
                    const train_details_html = response.data;
                    const train_details_$ = cheerio.load(train_details_html);

                    const train_station_name_element: any = train_details_$(
                      ".route-station-name"
                    );

                    const train_station_time_element: any = train_details_$(
                      ".route-other-info ul li:nth-child(3) span:nth-child(2)"
                    );

                    const station_list = [];
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
                          train_station_time_element[j - 1].children[0].data;
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
                    }
                    available_train_list[i].station_list = station_list;
                    const station_pairs = generatePairs(station_list);
                    for (let k = 0; k < station_pairs.length; k++) {
                      const station_pair = station_pairs[k];
                      await makeSessionRequest(
                        `/booking/train/search/en?fromcity=${station_pair.fromcity}&tocity=${station_pair.tocity}&doj=${station_pair.doj}&class=S_CHAIR`
                      )
                        .then(async (response: any) => {
                          const spinner = ["-", "\\", "|", "/"];
                          const index = k % 4;
                          // clear the current line
                          // process.stdout.clearLine(0);
                          // process.stdout.write(
                          //   `\r${spinner[index]} Searching for ${station_pair.fromcity} to ${station_pair.tocity} on ${station_pair.doj} in ${train_name}`
                          // );
                          console.log(
                            `\r${spinner[index]} Searching for ${station_pair.fromcity} to ${station_pair.tocity} on ${station_pair.doj} in ${train_name}`
                          );
                          controller.enqueue(
                            JSON.stringify(
                              `\r${spinner[index]} Searching for ${station_pair.fromcity} to ${station_pair.tocity} on ${station_pair.doj} in ${train_name}`
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
                                    if (seat_class === "AC_S") {
                                      station_pairs[k].available_seat.ac_s =
                                        parseInt(seat_available, 10);
                                    } else if (seat_class === "AC_B") {
                                      station_pairs[k].available_seat.ac_b =
                                        parseInt(seat_available, 10);
                                    } else if (seat_class === "SNIGDHA") {
                                      station_pairs[k].available_seat.snigdha =
                                        parseInt(seat_available, 10);
                                    } else if (seat_class === "S_CHAIR") {
                                      station_pairs[k].available_seat.s_chair =
                                        parseInt(seat_available, 10);
                                    }
                                  }
                                }
                              }
                            })
                            .catch((error) => {
                              console.error("Error fetching data:", error);
                            });
                        })
                        .catch((error) => {
                          console.error("Error fetching data:", error);
                        });
                    }
                    available_train_list[i].station_pairs = station_pairs;
                  })
                  .catch((error) => {
                    console.error("Error fetching data:", error);
                  });
              }
            })
            .catch((error) => {
              console.error("Error fetching data:", error);
            });
          // controller.enqueue(json(available_train_list));
          controller.close();
        })
        .catch((error) => {
          console.error("Error fetching data:", error);
        });
    },
  });
}

export async function POST(request: Request) {
  const stream = getStream(request);

  return new Response(stream);
}
