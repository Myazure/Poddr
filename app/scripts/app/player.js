angular
	.module("poddr")
	.controller("PlayerController", function (
		$scope,
		$rootScope,
		$mdDialog,
		$mdSidenav,
		PlayerService,
		$timeout,
		ToastService,
		FavouriteService,
		FavouriteFactory,
		PrevPlayedService
	) {
		var ipc = require("electron").ipcRenderer;
		var log = require("electron-log");
		const Store = require("electron-store");
		const store = new Store();

		$scope.episodesNav = $mdSidenav("right");

		var mprisPlayer;
		if (process.platform == "linux") {
			var mpris = require("mpris-service");

			mprisPlayer = mpris({
				name: "poddr",
				identity: "Poddr",
				canRaise: true,
				supportedInterfaces: ["player"]
			});

			mprisPlayer.rate = 1 + 1e-15;
			mprisPlayer.minimumRate = 1 + 1e-15;
			mprisPlayer.maximumRate = 1 + 1e-15;
			mprisPlayer.canPlay = true;
			mprisPlayer.canPause = true;
			mprisPlayer.canSeek = false;
			mprisPlayer.canControl = false;
			mprisPlayer.canGoNext = false;
			mprisPlayer.canGoPrevious = false;
			mprisPlayer.canEditTracks = false;
			mprisPlayer.playbackStatus = "Stopped";

			mprisPlayer.on("playpause", function () {
				togglePlay();
			});

			mprisPlayer.on("play", function () {
				if (player.paused) togglePlay();
			});

			mprisPlayer.on("pause", function () {
				if (!player.paused) togglePlay();
			});

			mprisPlayer.on("quit", function () {
				ipc.send("quit-app");
			});

			mprisPlayer.on("raise", function () {
				ipc.send("raise-app");
			});
		}

		//create the audio element
		var player = document.createElement("audio");
		player.volume = $scope.volume = 0.5;
		$scope.barWidth = 0;
		$scope.isLoading = false;
		$scope.playerService = PlayerService;

		//listen for messages from main process
		ipc.on("toggle-play", function (event, message) {
			log.info("IPC~ Toggle Play/Pause.");
			togglePlay();
		});

		log.info("Getting saved playerstate.");
		var playerState = store.get("playerState");
		if (playerState) {
			player.src = PlayerService.podcastURL = playerState.podcastURL;
			PlayerService.podcastCover = playerState.podcastCover;
			PlayerService.episodeCover = playerState.episodeCover;
			PlayerService.podcastTitle = playerState.podcastTitle;
			PlayerService.podcastEpisodeTitle = playerState.podcastEpisodeTitle;
			PlayerService.podcastDescription = playerState.podcastDescription;
			PlayerService.podcastGUID = playerState.podcastGUID;
			PlayerService.podcastRSS = playerState.podcastRSS;
			log.info("Loaded playerstate.");
		}

		if (process.platform == "linux") {
			$timeout(function () {
				log.info("Initialize MPRIS metadata.");
				mprisPlayer.metadata = {
					"mpris:artUrl": playerState.episodeCover || playerState.podcastCover || "",
					"xesam:title": playerState.podcastEpisodeTitle || "No title",
					"xesam:album": "Podcast",
					"xesam:artist": [playerState.podcastTitle || "No artist"]
				};
			}, 3000);
		}

		log.info("Getting saved volume.");
		player.volume = $scope.volume = store.get("volume", 0.5);

		player.addEventListener("play", function () {
			log.info("Playing podcast.");
			if (process.platform == "linux") mprisPlayer.playbackStatus = "Playing";
		});

		player.addEventListener("pause", function () {
			log.info("Paused podcast.");
			if (process.platform == "linux") mprisPlayer.playbackStatus = "Stopped";
		});

		player.addEventListener("loadstart", function () {
			log.info("Started loading podcast...");
			$scope.isLoading = true;
			$scope.$digest();
		});

		player.addEventListener("timeupdate", function () {
			PlayerService.atTime = player.currentTime;
			$scope.barWidth = getBarWidth();
			$scope.$digest();
		});

		function getBarWidth() {
			return (player.currentTime / player.duration) * 100;
		}

		player.addEventListener("seeking", function () {
			log.info("Seeking...");
			$scope.isLoading = true;
			$scope.$digest();
		});

		player.addEventListener("canplaythrough", function (e) {
			log.info("Can play through podcast.");
			PlayerService.podcastDuration = player.duration;
			$scope.isLoading = false;
			$scope.$digest();
		});

		player.addEventListener("ended", function () {
			log.info("Podcast ended.");
			PrevPlayedService.setPrevPlayed(PlayerService.podcastGUID);
			ToastService.successToast("Podcast ended.");
		});

		player.addEventListener("error", function failed(e) {
			log.error(e.target.error.message);
			ToastService.errorToast("Couldn't play podcast.");
			$scope.isLoading = false;
		});

		function playPodcast(episode) {
			log.info("Playing " + episode.title + ".");
			player.src = episode.enclosure.url;
			player.play();

			PlayerService.podcastURL = episode.enclosure.url;
			PlayerService.podcastEpisodeTitle = episode.title;
			PlayerService.podcastDuration = 0;
			PlayerService.podcastTitle = PlayerService.latestSeenTitle;
			PlayerService.podcastDescription = episode.description;
			PlayerService.podcastRSS = PlayerService.latestSeenRSS;
			PlayerService.podcastCover = PlayerService.latestSeenCover;
			PlayerService.podcastGUID = episode.guid;

			//If there's no episode image, use the podcasts image instead
			if (episode.image == null) {
				PlayerService.episodeCover = PlayerService.podcastCover;
			} else {
				PlayerService.episodeCover = episode.image;
			}

			if (process.platform == "linux") {
				log.info("Setting MPRIS metadata.");
				mprisPlayer.metadata = {
					"mpris:artUrl": PlayerService.episodeCover || "",
					"xesam:title": PlayerService.podcastEpisodeTitle || "No title",
					"xesam:album": "Podcast",
					"xesam:artist": [PlayerService.podcastTitle || "No artist"]
				};
			}

			PlayerService.saveState();
		}
		$rootScope.playPodcast = playPodcast;

		var progress = document.getElementById("progress");
		progress.addEventListener("click", function (event) {
			log.info("Clicked progressbar.");
			var width = event.clientX - progress.getBoundingClientRect().left;
			var calc = (width / progress.offsetWidth) * player.duration;
			player.currentTime = parseFloat(calc);
		}, true);

		function changePlayerTime(amount) {
			player.currentTime = player.currentTime + amount;
			$scope.$digest();
		}
		$rootScope.changePlayerTime = changePlayerTime;

		$scope.isPlaying = function () {
			return !player.paused;
		};

		$scope.isMuted = function () {
			return player.volume == 0 || player.muted;
		};

		function togglePlay() {
			log.info("Toggle Play/Pause.");
			if (player.src) {
				if (player.paused) {
					player.play();
				} else {
					player.pause();
				}
			}
		}
		$rootScope.togglePlay = togglePlay;

		$scope.setFavourite = function () {
			if (PlayerService.podcastRSS != "0") {
				FavouriteService.favourite(
					PlayerService.podcastRSS,
					PlayerService.podcastCover,
					PlayerService.podcastTitle
				);
			}
		};

		$scope.showEpisodes = function () {
			$rootScope.openEpisodes(PlayerService.podcastRSS, PlayerService.podcastTitle, PlayerService.podcastCover);
		};

		$scope.favouriteList = FavouriteFactory.getList();
		$scope.isPlayerFavourite = function () {
			return $scope.favouriteList.titles.indexOf(PlayerService.podcastTitle) !== -1;
		};

		$scope.showDescription = function (title, text) {
			$mdDialog.show({
				templateUrl: __dirname + "/views/dialog.html",
				locals: { title: title, text: text },
				clickOutsideToClose: true,
				escapeToClose: true,
				controller: function ($scope, title, text) {
					$scope.title = title;
					$scope.desc = text;
				}
			});
		};

		$scope.setVolume = function () {
			player.volume = $scope.volume;
			store.set("volume", player.volume);
		};

		function changeVolume(amount) {
			if (player.volume + amount > 1) {
				player.volume = 1;
			} else if (player.volume + amount < 0) {
				player.volume = 0;
			} else {
				player.volume += amount;
			}
			$scope.volume = player.volume;
			store.set("volume", player.volume);
			$scope.$digest();
		}
		$rootScope.changeVolume = changeVolume;
	});
