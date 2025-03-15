import { useState, useEffect, useRef } from "react";
import getAnimeInfo from "@/src/utils/getAnimeInfo.utils";
import getStreamInfo from "@/src/utils/getStreamInfo.utils";
import getEpisodes from "@/src/utils/getEpisodes.utils";
import getNextEpisodeSchedule from "../utils/getNextEpisodeSchedule.utils";
import getServers from "../utils/getServers.utils";

export const useWatch = (animeId, initialEpisodeId) => {
  const [error, setError] = useState(null);
  const [buffering, setBuffering] = useState(true);
  const [streamInfo, setStreamInfo] = useState(null);
  const [animeInfo, setAnimeInfo] = useState(null);
  const [episodes, setEpisodes] = useState(null);
  const [animeInfoLoading, setAnimeInfoLoading] = useState(false);
  const [totalEpisodes, setTotalEpisodes] = useState(null);
  const [seasons, setSeasons] = useState(null);
  const [servers, setServers] = useState(null);
  const [streamUrl, setStreamUrl] = useState(null);
  const [isFullOverview, setIsFullOverview] = useState(false);
  const [subtitles, setSubtitles] = useState([]);
  const [thumbnail, setThumbnail] = useState(null);
  const [intro, setIntro] = useState(null);
  const [outro, setOutro] = useState(null);
  const [episodeId, setEpisodeId] = useState(null);
  const [activeEpisodeNum, setActiveEpisodeNum] = useState(null);
  const [activeServerId, setActiveServerId] = useState(null);
  const [serverLoading, setServerLoading] = useState(true);
  const [nextEpisodeSchedule, setNextEpisodeSchedule] = useState(null);
  const isServerFetchInProgress = useRef(false);

  // Reset all states when animeId changes
  useEffect(() => {
    setEpisodes(null);
    setEpisodeId(null); // Reset episodeId immediately to null
    setActiveEpisodeNum(null);
    setServers(null); // Clear servers to prevent premature stream fetch
    setActiveServerId(null); // Clear activeServerId
    setStreamInfo(null);
    setStreamUrl(null);
    setSubtitles([]);
    setThumbnail(null);
    setIntro(null);
    setOutro(null);
    setBuffering(true);
    setServerLoading(true);
    setError(null);
    setAnimeInfo(null);
    setSeasons(null);
    setTotalEpisodes(null);
    setAnimeInfoLoading(true);
  }, [animeId]);

  // Fetch anime info and episodes, then set episodeId
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        // Fetch anime info and episodes concurrently
        const [animeData, episodesData] = await Promise.all([
          getAnimeInfo(animeId, false),
          getEpisodes(animeId),
        ]);

        setAnimeInfo(animeData?.data);
        setSeasons(animeData?.seasons);

        setEpisodes(episodesData?.episodes);
        setTotalEpisodes(episodesData?.totalEpisodes);

        // Set episodeId: prioritize initialEpisodeId, fallback to first episode
        const newEpisodeId =
          initialEpisodeId ||
          (episodesData?.episodes?.length > 0
            ? episodesData.episodes[0].id.match(/ep=(\d+)/)?.[1]
            : null);
        setEpisodeId(newEpisodeId);
      } catch (err) {
        console.error("Error fetching initial data:", err);
        setError(err.message || "An error occurred.");
      } finally {
        setAnimeInfoLoading(false);
      }
    };

    fetchInitialData();
  }, [animeId, initialEpisodeId]);

  // Fetch next episode schedule
  useEffect(() => {
    const fetchNextEpisodeSchedule = async () => {
      try {
        const data = await getNextEpisodeSchedule(animeId);
        setNextEpisodeSchedule(data);
      } catch (err) {
        console.error("Error fetching next episode schedule:", err);
      }
    };
    fetchNextEpisodeSchedule();
  }, [animeId]);

  // Update activeEpisodeNum when episodeId or episodes change
  useEffect(() => {
    if (!episodes || !episodeId) {
      setActiveEpisodeNum(null);
      return;
    }
    const activeEpisode = episodes.find((episode) => {
      const match = episode.id.match(/ep=(\d+)/);
      return match && match[1] === episodeId;
    });
    const newActiveEpisodeNum = activeEpisode ? activeEpisode.episode_no : null;
    if (activeEpisodeNum !== newActiveEpisodeNum) {
      setActiveEpisodeNum(newActiveEpisodeNum);
    }
  }, [episodeId, episodes]);

  // Fetch servers only when episodeId and episodes are ready
  useEffect(() => {
    if (!episodeId || !episodes || isServerFetchInProgress.current) return;

    const fetchServers = async () => {
      isServerFetchInProgress.current = true;
      setServerLoading(true);
      console.log(
        `Fetching servers for animeId: ${animeId}, episodeId: ${episodeId}`
      );
      try {
        const data = await getServers(animeId, episodeId);
        const filteredServers = data?.filter(
          (server) =>
            server.serverName === "HD-1" || server.serverName === "HD-2"
        );
        setServers(filteredServers);
        const initialServer =
          data.find(
            (server) => server.type === "sub" && server.serverName === "HD-1"
          ) ||
          data.find(
            (server) => server.type === "sub" && server.serverName === "HD-2"
          ) ||
          data.find(
            (server) => server.type === "dub" && server.serverName === "HD-1"
          ) ||
          data.find(
            (server) => server.type === "dub" && server.serverName === "HD-2"
          ) ||
          data.find(
            (server) => server.type === "raw" && server.serverName === "HD-1"
          ) ||
          data.find(
            (server) => server.type === "raw" && server.serverName === "HD-2"
          ) ||
          filteredServers[0];
        setActiveServerId(initialServer?.data_id);
      } catch (error) {
        console.error("Error fetching servers:", error);
        setError(error.message || "An error occurred.");
      } finally {
        setServerLoading(false);
        isServerFetchInProgress.current = false;
      }
    };
    fetchServers();
  }, [episodeId, episodes]);

  // Fetch stream info only when episodeId, activeServerId, and servers are ready
  useEffect(() => {
    if (
      !episodeId ||
      !activeServerId ||
      !servers ||
      isServerFetchInProgress.current
    )
      return;

    const fetchStreamInfo = async () => {
      setBuffering(true);
      console.log(
        `Fetching stream for animeId: ${animeId}, episodeId: ${episodeId}, serverId: ${activeServerId}`
      );
      try {
        const server = servers.find((srv) => srv.data_id === activeServerId);
        if (server) {
          const data = await getStreamInfo(
            animeId,
            episodeId,
            server.serverName.toLowerCase(),
            server.type.toLowerCase()
          );
          setStreamInfo(data);
          setStreamUrl(data?.streamingLink?.link?.file || null);
          setIntro(data?.streamingLink?.intro || null);
          setOutro(data?.streamingLink?.outro || null);
          const subtitles =
            data?.streamingLink?.tracks
              ?.filter((track) => track.kind === "captions")
              .map(({ file, label }) => ({ file, label })) || [];
          setSubtitles(subtitles);
          const thumbnailTrack = data?.streamingLink?.tracks?.find(
            (track) => track.kind === "thumbnails" && track.file
          );
          if (thumbnailTrack) setThumbnail(thumbnailTrack.file);
        } else {
          setError("No server found with the activeServerId.");
        }
      } catch (err) {
        console.error("Error fetching stream info:", err);
        setError(err.message || "An error occurred.");
      } finally {
        setBuffering(false);
      }
    };
    fetchStreamInfo();
  }, [episodeId, activeServerId, servers]); // Removed animeId from dependencies

  return {
    error,
    buffering,
    serverLoading,
    streamInfo,
    animeInfo,
    episodes,
    nextEpisodeSchedule,
    animeInfoLoading,
    totalEpisodes,
    seasons,
    servers,
    streamUrl,
    isFullOverview,
    setIsFullOverview,
    subtitles,
    thumbnail,
    intro,
    outro,
    episodeId,
    setEpisodeId,
    activeEpisodeNum,
    setActiveEpisodeNum,
    activeServerId,
    setActiveServerId,
  };
};
