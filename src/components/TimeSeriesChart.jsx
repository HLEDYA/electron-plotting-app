import React, { useEffect, useState } from "react";

import moment from "moment";
import "moment-duration-format";

import {
  AreaChart,
  Baseline,
  Brush,
  Charts,
  ChartContainer,
  ChartRow,
  LabelAxis,
  YAxis,
  LineChart,
  ValueAxis,
  styler,
  Legend,
  Resizable,
} from "react-timeseries-charts";
import _ from "underscore";

import { format } from "d3-format";

// Pond
import { TimeSeries, TimeRange } from "pondjs";

const style = styler([
  { key: "rms", color: "#e2e2e2" },
  { key: "z", color: "#ff47ff" },
  { key: "y", color: "green", width: 1, opacity: 0.5 },
  { key: "x", color: "steelblue", width: 1, opacity: 0.5 },
]);

// Baselines are the dotted average lines displayed on the chart
// In this case these are separately styled
const baselineStyles = {
  x: {
    stroke: "steelblue",
    opacity: 0.5,
    width: 0.25,
  },
  y: {
    stroke: "green",
    opacity: 0.5,
    width: 0.25,
  },
};

// d3 formatter to display the speed with one decimal place
const speedFormat = format(".1f");

const TimeSeriesChart = (props) => {
  console.log("TimeSeriesChart loaded");

  const initialRange = new TimeRange([75 * 60 * 1000, 125 * 60 * 1000]);
  const { rcvdData } = props;

  // Storage for all the data channels
  const channels = {
    x: {
      units: "cm/s2",
      label: "x",
      format: ",.1f",
      series: null,
      show: true,
    },
    y: {
      units: "cm/s2",
      label: "y",
      format: ",.1f",
      series: null,
      show: true,
    },
    z: {
      units: "cm/s2",
      label: "z",
      format: ",.1f",
      series: null,
      show: true,
    },
    rms: {
      units: "rms",
      label: "RMS",
      format: ",.1f",
      series: null,
      show: true,
    },
  };

  // Channel names list, in order we want them shown
  const channelNames = ["x", "y", "z", "rms"];

  // Channels we'll actually display on our charts
  const displayChannels = ["x", "y", "z"];

  useEffect(() => {
    console.log("useEffect: data points created");
    const points = {};
    channelNames.forEach((channel) => {
      points[channel] = [];
    });

    let prevTime = 0;
    for (let i = 0; i < rcvdData.length; i += 1) {
      const time = rcvdData[i][0] * 1000;
      // there are some data for the same time point in the file. Removing them
      if (time < prevTime) continue;
      prevTime = time;
      const x = parseFloat(rcvdData[i][1]);
      const y = parseFloat(rcvdData[i][1]);
      const z = parseFloat(rcvdData[i][1]);
      points["x"].push([time, x]);
      points["y"].push([time, y]);
      points["z"].push([time, z]);
      const rms = Math.sqrt(x * x + y * y);
      points["rms"].push([time, rms]);
    }

    // Make the TimeSeries here from the points collected above
    for (let channelName of channelNames) {
      //
      // The TimeSeries itself, for this channel
      const series = new TimeSeries({
        name: channels[channelName].name,
        columns: ["time", channelName],
        points: points[channelName],
      });

      // Raw series
      channels[channelName].series = series;

      // Some simple statistics for each channel
      channels[channelName].avg = parseFloat(series.avg(channelName));
      channels[channelName].max = parseFloat(series.max(channelName));
      channels[channelName].min = parseFloat(series.min(channelName));
    }

    // Min and max time constraints for pan/zoom, along with the smallest timerange
    // the user can zoom into. These are passed into the ChartContainers when we come to
    // rendering.
    const minTime = channels.rms.series.range().begin();
    const maxTime = channels.rms.series.range().end();
    const minDuration = 1 * 1000;

    // take first 250 samples as first range
    const firstRangeEnd = 250 * 60;
    const firstRange = new TimeRange([
      points["rms"][0][0],
      points["rms"][
        firstRangeEnd < points["rms"].length
          ? firstRangeEnd
          : points["rms"].length - 1
      ][0],
    ]);
    console.log(firstRange);

    setPlotState((prevState) => {
      return {
        ...prevState,
        ready: true,
        channels,
        minTime,
        maxTime,
        timerange: firstRange,
        brushrange: firstRange,
        minDuration,
      };
    });
  }, []);

  const initialState = {
    ready: false,
    mode: "channels",
    channels,
    channelNames,
    displayChannels,
    tracker: null,
    timerange: initialRange,
    brushrange: initialRange,
  };

  const [plotState, setPlotState] = useState(initialState);

  const handleTrackerChanged = (t) => {
    setPlotState((prevState) => {
      return { ...prevState, tracker: t };
    });
  };

  // Handles when the brush changes the timerange
  const handleTimeRangeChange = (timerange) => {
    const { channels } = plotState;

    if (timerange) {
      setPlotState((prevState) => {
        return { ...prevState, timerange, brushrange: timerange };
      });
    } else {
      setPlotState((prevState) => {
        return {
          ...prevState,
          timerange: channels["rms"].range(),
          brushrange: null,
        };
      });
    }
  };

  const handleChartResize = (width) => {
    setPlotState((prevState) => {
      return { ...prevState, width };
    });
  };

  const handleActiveChange = (channelName) => {
    const channels = plotState.channels;
    channels[channelName].show = !channels[channelName].show;
    setPlotState((prevState) => {
      return { ...prevState, channels };
    });
  };

  const renderChannelsChart = () => {
    console.log("renderChannelsChart");

    const rows = [];
    for (let channelName of displayChannels) {
      const charts = [];
      let series = plotState.channels[channelName].series;

      charts.push(
        <LineChart
          key={`line-${channelName}`}
          axis={`${channelName}_axis`}
          series={series}
          columns={[channelName]}
          style={style}
          breakLine
        />
      );
      charts.push(
        <Baseline
          key={`baseline-${channelName}`}
          axis={`${channelName}_axis`}
          style={baselineStyles.speed}
          value={channels[channelName].avg}
        />
      );

      // Get the value at the current tracker position for the ValueAxis
      let value = "--";
      if (plotState.tracker) {
        const approx =
          (+plotState.tracker - +plotState.timerange.begin()) /
          (+plotState.timerange.end() - +plotState.timerange.begin());
        const ii = Math.floor(approx * series.size());
        const i = series.bisect(new Date(plotState.tracker), ii);
        const v = i < series.size() ? series.at(i).get(channelName) : null;
        if (v) {
          value = parseFloat(v);
        }
      }

      // Get the summary values for the LabelAxis
      const summary = [
        {
          label: "Max",
          value: speedFormat(plotState.channels[channelName].max),
        },
        {
          label: "Min",
          value: speedFormat(plotState.channels[channelName].min),
        },
      ];

      rows.push(
        <ChartRow
          height="120"
          visible={plotState.channels[channelName].show}
          key={`row-${channelName}`}
        >
          <LabelAxis
            id={`${channelName}_axis`}
            label={plotState.channels[channelName].label}
            values={summary}
            min={plotState.channels[channelName].min}
            max={plotState.channels[channelName].max}
            width={160}
            type="linear"
            format=",.1f"
          />
          <Charts>{charts}</Charts>
          <ValueAxis
            id={`${channelName}_valueaxis`}
            value={value}
            detail={channels[channelName].units}
            width={80}
            min={0}
            max={35}
          />
        </ChartRow>
      );
    }

    return (
      <ChartContainer
        timeRange={plotState.timerange}
        format="relative"
        showGrid={false}
        enablePanZoom
        maxTime={plotState.maxTime}
        minTime={plotState.minTime}
        minDuration={plotState.minDuration}
        trackerPosition={plotState.tracker}
        onTimeRangeChanged={handleTimeRangeChange}
        onChartResize={(width) => handleChartResize(width)}
        onTrackerChanged={handleTrackerChanged}
      >
        {rows}
      </ChartContainer>
    );
  };

  const renderChart = () => {
    console.log("renderChart");
    // if (plotState.mode === "multiaxis")
    //   return renderMultiAxisChart();
    //  else if (plotState.mode === "channels")
    return renderChannelsChart();
  };

  const renderBrush = () => {
    const { channels } = plotState;
    return (
      <ChartContainer
        timeRange={channels.rms.series.range()}
        format="relative"
        trackerPosition={plotState.tracker}
      >
        <ChartRow height="100" debug={false}>
          <Brush
            timeRange={plotState.brushrange}
            allowSelectionClear
            onTimeRangeChanged={handleTimeRangeChange}
          />
          <YAxis
            id="axis1"
            label="RMS"
            min={0}
            max={channels.rms.max}
            width={70}
            type="linear"
            format="d"
          />
          <Charts>
            <AreaChart
              axis="axis1"
              style={style.areaChartStyle()}
              columns={{ up: ["rms"], down: [] }}
              series={channels.rms.series}
            />
          </Charts>
        </ChartRow>
      </ChartContainer>
    );
  };

  const renderMode = () => {
    const linkStyle = {
      fontWeight: 600,
      color: "grey",
      cursor: "default",
    };

    const linkStyleActive = {
      color: "steelblue",
      cursor: "pointer",
    };

    return (
      <div className="col-md-6" style={{ fontSize: 14, color: "#777" }}>
        <span
          style={plotState.mode !== "multiaxis" ? linkStyleActive : linkStyle}
          onClick={() =>
            setPlotState((prevState) => {
              return { ...prevState, mode: "multiaxis" };
            })
          }
        >
          Multi-axis
        </span>
        <span> | </span>
        <span
          style={plotState.mode !== "channels" ? linkStyleActive : linkStyle}
          onClick={() =>
            setPlotState((prevState) => {
              return { ...prevState, mode: "channels" };
            })
          }
        >
          Channels
        </span>
      </div>
    );
  };

  const renderModeOptions = () => {
    const linkStyle = {
      fontWeight: 600,
      color: "grey",
      cursor: "default",
    };

    const linkStyleActive = {
      color: "steelblue",
      cursor: "pointer",
    };

    return <div />;
  };

  const chartStyle = {
    borderStyle: "solid",
    borderWidth: 1,
    borderColor: "#DDD",
    paddingTop: 10,
    marginBottom: 10,
  };

  const brushStyle = {
    boxShadow: "inset 0px 2px 5px -2px rgba(189, 189, 189, 0.75)",
    background: "#FEFEFE",
    paddingTop: 10,
  };

  // Generate the legend
  const legend = displayChannels.map((channelName) => ({
    key: channelName,
    label: channels[channelName].label,
    disabled: !channels[channelName].show,
  }));

  return (
    <div>
      <div className="row">
        {renderMode()}
        {renderModeOptions()}
      </div>
      <div className="row">
        <div className="col-md-12">
          <hr />
        </div>
      </div>
      <div className="row">
        <div className="col-md-6">
          <Legend
            type={plotState.mode === "rollup" ? "swatch" : "line"}
            style={style}
            categories={legend}
            onSelectionChange={handleActiveChange}
          />
        </div>

        <div className="col-md-6">
          {plotState.tracker
            ? `${moment.duration(+plotState.tracker).format()}`
            : "-:--:--"}
        </div>
      </div>
      <div className="row">
        <div className="col-md-12">
          <hr />
        </div>
      </div>
      <div className="row">
        <div className="col-md-12" style={chartStyle}>
          <Resizable>
            {plotState.ready ? renderChart() : <div>Loading.....</div>}
          </Resizable>
        </div>
      </div>
      <div className="row">
        <div className="col-md-12" style={brushStyle}>
          <Resizable>{plotState.ready ? renderBrush() : <div />}</Resizable>
        </div>
      </div>
    </div>
  );
};

export default TimeSeriesChart;
