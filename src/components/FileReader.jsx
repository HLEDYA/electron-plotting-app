import React, { useState } from "react";
import Papa from "papaparse";

const FileReader = (props) => {
  // State to store parsed data
  const [parsedData, setParsedData] = useState([]);

  //State to store table Column name
  const [tableRows, setTableRows] = useState([]);

  //State to store the values
  const [values, setValues] = useState([]);

  const changeHandler = (event) => {
    // Passing file data (event.target.files[0]) to parse using Papa.parse
    Papa.parse(event.target.files[0], {
      header: false,
      skipEmptyLines: true,
      complete: function (results) {
        const rowsArray = [];
        const valuesArray = [];

        // Iterating data to get column name and their values
        results.data.map((d) => {
          rowsArray.push(Object.keys(d));
          valuesArray.push(Object.values(d));
        });

        // Parsed Data Response in array format
        props.onDataRead(results.data);
      },
    });
  };

  return (
    <div>
      {/* File Uploader */}
      <h4
        style={{
          display: "block",
          paddingBottom: "1rem",
          width: "10rem",
          margin: "auto",
        }}
      >
        File Uploader
      </h4>
      <input
        type="file"
        name="file"
        onChange={changeHandler}
        accept=".csv"
        style={{ display: "block", margin: "auto" }}
      />
    </div>
  );
};

export default FileReader;
