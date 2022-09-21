import React, { useEffect, useState } from "react";

import moment from "moment";
import "moment-duration-format";

import {
  AreaChart,
  Baseline,
  BoxChart,
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
import { TimeSeries, TimeRange, avg, percentile, median } from "pondjs";

const data = require("../../data/bike.json");

const style = styler([
  { key: "distance", color: "#e2e2e2" },
  { key: "altitude", color: "#e2e2e2" },
  { key: "cadence", color: "#ff47ff" },
  { key: "power", color: "green", width: 1, opacity: 0.5 },
  { key: "temperature", color: "#cfc793" },
  { key: "speed", color: "steelblue", width: 1, opacity: 0.5 },
]);

// Baselines are the dotted average lines displayed on the chart
// In this case these are separately styled

const baselineStyles = {
  speed: {
    stroke: "steelblue",
    opacity: 0.5,
    width: 0.25,
  },
  power: {
    stroke: "green",
    opacity: 0.5,
    width: 0.25,
  },
};

// d3 formatter to display the speed with one decimal place
const speedFormat = format(".1f");

const TimeSeriesChart = () => {
  const initialRange = new TimeRange([75 * 60 * 1000, 125 * 60 * 1000]);

  // Storage for all the data channels
  const channels = {
    distance: {
      units: "miles",
      label: "Distance",
      format: ",.1f",
      series: null,
      show: false,
    },
    altitude: {
      units: "feet",
      label: "Altitude",
      format: "d",
      series: null,
      show: false,
    },
    cadence: {
      units: "rpm",
      label: "Cadence",
      format: "d",
      series: null,
      show: true,
    },
    power: {
      units: "watts",
      label: "Power",
      format: ",.1f",
      series: null,
      show: true,
    },
    temperature: {
      units: "deg F",
      label: "Temp",
      format: "d",
      series: null,
      show: false,
    },
    speed: {
      units: "mph",
      label: "Speed",
      format: ",.1f",
      series: null,
      show: true,
    },
  };

  // Channel names list, in order we want them shown
  const channelNames = [
    "speed",
    "power",
    "cadence",
    "temperature",
    "distance",
    "altitude",
  ];

  // Channels we'll actually display on our charts
  const displayChannels = ["speed", "power", "cadence"];

  // Rollups we'll generate to reduce data for the screen
  const rollupLevels = ["1s", "5s", "15s", "25s"];

  useEffect(() => {
    const points = {};
    channelNames.forEach((channel) => {
      points[channel] = [];
    });

    for (let i = 0; i < data.time.length; i += 1) {
      if (i > 0) {
        const deltaTime = data.time[i] - data.time[i - 1];
        const time = data.time[i] * 1000;

        points["distance"].push([time, data.distance[i]]);
        points["altitude"].push([time, data.altitude[i] * 3.28084]); // convert m to ft
        points["cadence"].push([time, data.cadence[i]]);
        points["power"].push([time, data.watts[i]]);
        points["temperature"].push([time, data.temp[i]]);

        // insert a null into the speed data to put breaks in the data where
        // the rider was stationary
        if (deltaTime > 10) {
          points["speed"].push([time - 1000, null]);
        }

        const speed =
          (data.distance[i] - data.distance[i - 1]) /
          (data.time[i] - data.time[i - 1]); // meters/sec
        points["speed"].push([time, 2.236941 * speed]); // convert m/s to miles/hr
      }
    }

    // Make the TimeSeries here from the points collected above
    for (let channelName of channelNames) {
      // The TimeSeries itself, for this channel
      const series = new TimeSeries({
        name: channels[channelName].name,
        columns: ["time", channelName],
        points: points[channelName],
      });

      if (_.contains(displayChannels, channelName)) {
        const rollups = _.map(rollupLevels, (rollupLevel) => {
          return {
            duration: parseInt(rollupLevel.split("s")[0], 10),
            series: series.fixedWindowRollup({
              windowSize: rollupLevel,
              aggregation: { [channelName]: { [channelName]: avg() } },
            }),
          };
        });

        // Rollup series levels
        channels[channelName].rollups = rollups;
      }

      // Raw series
      channels[channelName].series = series;

      // Some simple statistics for each channel
      channels[channelName].avg = parseInt(series.avg(channelName), 10);
      channels[channelName].max = parseInt(series.max(channelName), 10);
    }

    // Min and max time constraints for pan/zoom, along with the smallest timerange
    // the user can zoom into. These are passed into the ChartContainers when we come to
    // rendering.
    const minTime = channels.altitude.series.range().begin();
    const maxTime = channels.altitude.series.range().end();
    const minDuration = 10 * 60 * 1000;

    setPlotState((prevState) => {
      return {
        ...prevState,
        ready: true,
        channels,
        minTime,
        maxTime,
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
    rollupLevels,
    rollup: "1m",
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
          timerange: channels["altitude"].range(),
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

    const durationPerPixel = plotState.timerange.duration() / 800 / 1000;
    const rows = [];

    console.log(displayChannels);

    for (let channelName of displayChannels) {
      const charts = [];
      let series = plotState.channels[channelName].series;
      console.log(series);
      _.forEach(channels[channelName].rollups, (rollup) => {
        if (rollup.duration < durationPerPixel * 2) {
          series = rollup.series.crop(plotState.timerange);
        }
      });

      console.log(series);

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
          value = parseInt(v, 10);
        }
      }

      // Get the summary values for the LabelAxis
      const summary = [
        { label: "Max", value: speedFormat(channels[channelName].max) },
        { label: "Avg", value: speedFormat(channels[channelName].avg) },
      ];

      rows.push(
        <ChartRow
          height="100"
          visible={plotState.channels[channelName].show}
          key={`row-${channelName}`}
        >
          <LabelAxis
            id={`${channelName}_axis`}
            label={plotState.channels[channelName].label}
            values={summary}
            min={0}
            max={plotState.channels[channelName].max}
            width={140}
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
    // if (plotState.mode === "multiaxis") {
    //   return renderMultiAxisChart();
    // } else if (plotState.mode === "channels") {
    return renderChannelsChart();
    // } else if (plotState.mode === "rollup") {
    //   return this.renderBoxChart();
    // }
    // return <div>No chart</div>;
  };

  const renderBrush = () => {
    const { channels } = plotState;
    return (
      <ChartContainer
        timeRange={channels.altitude.series.range()}
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
            label="Altitude (ft)"
            min={0}
            max={channels.altitude.max}
            width={70}
            type="linear"
            format="d"
          />
          <Charts>
            <AreaChart
              axis="axis1"
              style={style.areaChartStyle()}
              columns={{ up: ["altitude"], down: [] }}
              series={channels.altitude.series}
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
        <span> | </span>
        <span
          style={plotState.mode !== "rollup" ? linkStyleActive : linkStyle}
          onClick={() =>
            setPlotState((prevState) => {
              return { ...prevState, mode: "rollup" };
            })
          }
        >
          Rollups
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

    if (plotState.mode === "multiaxis") {
      return <div />;
    } else if (plotState.mode === "channels") {
      return <div />;
    } else if (plotState.mode === "rollup") {
      return (
        <div className="col-md-6" style={{ fontSize: 14, color: "#777" }}>
          <span
            style={plotState.rollup !== "1m" ? linkStyleActive : linkStyle}
            onClick={() =>
              setPlotState((prevState) => {
                return { ...plotState, rollup: "1m" };
              })
            }
          >
            1m
          </span>
          <span> | </span>
          <span
            style={plotState.rollup !== "5m" ? linkStyleActive : linkStyle}
            onClick={() =>
              setPlotState((prevState) => {
                return { ...plotState, rollup: "5m" };
              })
            }
          >
            5m
          </span>
          <span> | </span>
          <span
            style={plotState.rollup !== "15m" ? linkStyleActive : linkStyle}
            onClick={() =>
              setPlotState((prevState) => {
                return { ...plotState, rollup: "15m" };
              })
            }
          >
            15m
          </span>
        </div>
      );
    }
    return <div />;
  };

  if (!plotState.ready) {
    return <div>{`Building rollups...`}</div>;
  }
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
