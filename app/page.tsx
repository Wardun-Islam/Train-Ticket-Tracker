"use client"; // This is a client component

import React, { useEffect, useState } from "react";
import Select from "react-select";
import moment from "moment";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { cities } from "./constants/constants";

export default function Home() {
  const [isSearchable, setIsSearchable] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOption, setSelectedOption] = useState(null);
  const [dest_from_options, setDest_from_options] = useState<
    { value: string; label: string }[]
  >([]);
  const [dest_to_options, setDest_to_options] = useState<
    { value: string; label: string }[]
  >([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [minDate, setMinDate] = useState(new Date());
  const [maxDate, setMaxDate] = useState(
    new Date().setDate(new Date().getDate() + 9)
  );

  const colourStyles = {
    option: (styles: any) => {
      return {
        ...styles,
        color: "#000"
      };
    }
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

  return (
    <div className="bg-white black flex flex-col items-center justify-center min-h-screen ">
      <div className="w-96 shadow-md p-6 rounded-r">
        <p className="text-black py-2">From: </p>
        <Select
          className="basic-single"
          classNamePrefix="select"
          isLoading={isLoading}
          isSearchable={isSearchable}
          name="From"
          options={dest_from_options}
          styles={colourStyles}
        />
        <p className="text-black py-2">To: </p>
        <Select
          className="basic-single"
          classNamePrefix="select"
          isLoading={isLoading}
          isSearchable={isSearchable}
          name="To"
          options={dest_from_options}
          styles={colourStyles}
        />
        <p className="text-black py-2">Date: </p>
        <DatePicker
          dateFormat="dd/MM/yyyy"
          toggleCalendarOnIconClick
          showIcon
          selected={selectedDate}
          onChange={(date: any) => setSelectedDate(date)}
          minDate={minDate}
          maxDate={maxDate}
        />
        <button className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded w-full mt-3">
          Search
        </button>
      </div>
    </div>
  );
}
