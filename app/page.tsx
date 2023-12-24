"use client"; // This is a client component

import React, { useEffect, useState } from "react";
import Select from "react-select";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { cities } from "./constants/constants";
import { redirect } from "next/dist/server/api-utils";

export default function Home() {
  const [isSearchable, setIsSearchable] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDestFrom, setSelectedDestFrom] = useState<string | null>(null);
  const [dest_from_options, setDest_from_options] = useState<
    { value: string; label: string }[]
  >([]);
  const [selectedDestTo, setSelectedDestTo] = useState<string | null>(null);
  const [dest_to_options, setDest_to_options] = useState<
    { value: string; label: string }[]
  >([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [maxJourneyDate, setMaxJourneyDate] = useState(10);
  const [errorMessage, setErrorMessage] = useState("");

  const colourStyles = {
    option: (styles: any) => {
      return {
        ...styles,
        color: "#000",
      };
    },
  };

  useEffect(() => {
    let aSearch: { value: string; label: string }[] = [];
    cities.forEach(function (sElement) {
      if (sElement.is_enable_for_from == 1 && sElement.is_enable_for_web == 1) {
        aSearch.push({ value: sElement.city_name, label: sElement.city_name });
      }
    });
    setDest_from_options(aSearch);
    setDest_to_options(aSearch);
    setIsLoading(false);
  }, []);

  const getMaxJourneyDate = (
    selectedDestFrom: string | null,
    selectedDestTo: string | null
  ) => {
    let usualMaxJourneyDate = 10;
    let internationalMaxJourneyDate = 29;
    let internationalCityIdArray = [81, 872];
    let selectedFromStationObject = cities.filter((station) => {
      if (selectedDestFrom !== null)
        return (
          station.city_name.toLowerCase() === selectedDestFrom.toLowerCase()
        );
    });
    let selectedToStationObject = cities.filter((station) => {
      if (selectedDestTo !== null)
        return station.city_name.toLowerCase() === selectedDestTo.toLowerCase();
    });
    let isInternational = internationalCityIdArray.filter((cityId) => {
      let found = false;
      if (
        selectedFromStationObject.length > 0 &&
        cityId === selectedFromStationObject[0].city_id
      ) {
        found = true;
      }
      if (
        selectedToStationObject.length > 0 &&
        cityId === selectedToStationObject[0].city_id
      ) {
        found = true;
      }
      return found;
    });

    if (isInternational.length > 0) {
      return internationalMaxJourneyDate;
    } else {
      return usualMaxJourneyDate;
    }
  };

  const validateCity = (cityName: string) => {
    var filteredCity = cities.filter(function (city) {
      return city.city_name === cityName;
    });
    return filteredCity.length ? true : false;
  };

  function formatDate(date: Date) {
    const day = String(date.getDate()).padStart(2, "0");
    const monthIndex = date.getMonth();
    const year = date.getFullYear();

    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const monthName = monthNames[monthIndex];
    return `${day}-${monthName}-${year}`;
  }

  const handleDestFromChange = (selectedOption: any) => {
    setSelectedDestFrom(selectedOption.value);
    const newMaxJourneyDate = getMaxJourneyDate(
      selectedOption.value,
      selectedDestTo
    );
    if (newMaxJourneyDate != maxJourneyDate) {
      setMaxJourneyDate(newMaxJourneyDate);
      if (
        selectedDate >
        new Date(new Date().setDate(new Date().getDate() + newMaxJourneyDate))
      ) {
        setSelectedDate(
          new Date(new Date().setDate(new Date().getDate() + newMaxJourneyDate))
        );
      }
    }
    if (selectedOption.value === null || selectedOption.value === "") {
      setErrorMessage("Please choose departure station.");
    } else if (validateCity(selectedOption.value) === false) {
      setErrorMessage(
        "Please choose correct departure station (or choose from suggested stations)."
      );
    } else {
      setErrorMessage("");
    }
  };

  const handleDestToChange = (selectedOption: any) => {
    setSelectedDestTo(selectedOption.value);
    const newMaxJourneyDate = getMaxJourneyDate(
      selectedDestFrom,
      selectedOption.value
    );
    if (newMaxJourneyDate != maxJourneyDate) {
      setMaxJourneyDate(newMaxJourneyDate);
      if (
        selectedDate >
        new Date(new Date().setDate(new Date().getDate() + newMaxJourneyDate))
      ) {
        setSelectedDate(
          new Date(new Date().setDate(new Date().getDate() + newMaxJourneyDate))
        );
      }
    }
    if (selectedOption.value === null || selectedOption.value === "") {
      setErrorMessage("Please choose destination station.");
    } else if (validateCity(selectedOption.value) === false) {
      setErrorMessage(
        "Please choose correct destination station (or choose from suggested stations)."
      );
    } else {
      setErrorMessage("");
    }
  };

  const onSearchClick = () => {
    console.log(selectedDestFrom, selectedDestTo, selectedDate);
    if (window.navigator.onLine === false) {
      setErrorMessage("Please check your internet connection.");
    } else if (selectedDestFrom === null || selectedDestFrom === "") {
      setErrorMessage("Please choose departure station.");
    } else if (validateCity(selectedDestFrom) === false) {
      setErrorMessage(
        "Please choose correct departure station (or choose from suggested stations)."
      );
    } else if (selectedDestTo === null || selectedDestTo === "") {
      setErrorMessage("Please choose destination station.");
    } else if (validateCity(selectedDestTo) === false) {
      setErrorMessage(
        "Please choose correct destination station (or choose from suggested stations)."
      );
    } else if (selectedDate === null) {
      setErrorMessage("Please select date of your journey.");
    } else if (selectedDestFrom === selectedDestTo) {
      setErrorMessage(
        "Please choose different destination and departure station."
      );
    } else {
      setErrorMessage("");
      fetch(
        "https://eticket.railway.gov.bd/booking/train/search-route?fromcity=" +
          selectedDestFrom +
          "&tocity=" +
          selectedDestTo +
          "&doj=" +
          formatDate(selectedDate) +
          "&class=S_CHAIR"
      )
        .then((response) => {
          if (!response.ok) {
            throw new Error("Network response was not ok");
          }
          return response.json();
        })
        .then((data) => {
          if (data.type === "error") {
            setErrorMessage(data.message);
            return;
          } else {
            setErrorMessage("");
            // redirect to search
            window.location.href =
              "/search?fromcity=" +
              selectedDestFrom +
              "&tocity=" +
              selectedDestTo +
              "&doj=" +
              formatDate(selectedDate);
          }
        })
        .catch((error) => {
          setErrorMessage(
            "There has been a problem with your fetch operation:" + error
          );
        });
    }
  };

  return (
    <div className="bg-white black flex flex-col items-center justify-center min-h-screen ">
      <div className="w-96 shadow-md p-6 rounded-r">
        <p className="text-black py-2">From: </p>
        <Select
          id="from"
          className="basic-single"
          classNamePrefix="select"
          isLoading={isLoading}
          isSearchable={isSearchable}
          name="From"
          options={dest_from_options}
          styles={colourStyles}
          onChange={handleDestFromChange}
        />
        <p className="text-black py-2">To: </p>
        <Select
          id="to"
          className="basic-single"
          classNamePrefix="select"
          isLoading={isLoading}
          isSearchable={isSearchable}
          name="To"
          options={dest_to_options}
          styles={colourStyles}
          onChange={handleDestToChange}
        />
        <p className="text-black py-2">Date: </p>
        <DatePicker
          dateFormat="dd/MM/yyyy"
          showIcon
          selected={selectedDate}
          onChange={(date: any) => setSelectedDate(date)}
          minDate={new Date()}
          maxDate={
            new Date(new Date().setDate(new Date().getDate() + maxJourneyDate))
          }
        />
        <button
          onClick={onSearchClick}
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded w-full mt-3"
        >
          Search
        </button>
        {/* Error Message */}
        {errorMessage && errorMessage != null && (
          <div className="text-red-500 text-xs italic pt-2">{errorMessage}</div>
        )}
      </div>
    </div>
  );
}
