// ==UserScript==
// @name         YouTube Low-Quality Videos/Shorts Filter + Ads Sign Remover
// @namespace    http://tampermonkey.net/
// @version      2.1.8
// @description  Filters out low-view videos and shorts from recommendations + removes ads sign
// @author       NiceL
// @match        *://*.youtube.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=youtube.com
// @updateURL    https://raw.githubusercontent.com/N1ceL/qzUZ0MzKrx/refs/heads/main/yt-filter.js
// @downloadURL  https://raw.githubusercontent.com/N1ceL/qzUZ0MzKrx/refs/heads/main/yt-filter.js
// @grant        none
// ==/UserScript==

(function ()
{
    'use strict';

    //------------------------------------------------------------------------------------------------------
    // Configuration
    //------------------------------------------------------------------------------------------------------

    const Config =
    {
        // !!! YOU CAN EDIT SETTINGS HERE !!!
        EnableVideosFilter: true,
        EnableShortsFilter: true,
        EnableAdsSignRemover: true,

        MinShortsLikes: 100,

        Debug: true,
    };

    //------------------------------------------------------------------------------------------------------
    // Logger
    //------------------------------------------------------------------------------------------------------

    function Log(Category, Message)
    {
        if (!Config.Debug)
        {
            return;
        }

        console.log("[YT_Filter | " + Category + "] " + Message);
    }

    //------------------------------------------------------------------------------------------------------
    // URL Utilities
    //------------------------------------------------------------------------------------------------------

    function IsFeed()
    {
        var Pathname = location.pathname;

        return Pathname.startsWith("/feed")
            || Pathname.startsWith("/playlist")
            || Pathname.startsWith("/@");
    }

    function IsShorts()
    {
        return location.pathname.startsWith("/shorts");
    }

    //------------------------------------------------------------------------------------------------------
    // Text Analyzer
    //------------------------------------------------------------------------------------------------------

    function IsDigit(Char)
    {
        return Char >= '0' && Char <= '9';
    }

    function IsSpace(Char)
    {
        return Char === ' ';
    }

    function IsSeparator(Char)
    {
        return Char === '.' || Char === ',';
    }

    function ContainsDigit(Text)
    {
        for (var i = 0; i < Text.length; i++)
        {
            if (IsDigit(Text[i]))
            {
                return true;
            }
        }

        return false;
    }

    function HasLargeViewCount(Text)
    {
        for (var i = 0; i < Text.length - 2; i++)
        {
            var A = Text[i];
            var B = Text[i + 1];
            var C = Text[i + 2];

            // Pattern: "1K views" (letter + space + letter)
            if (!IsDigit(A) && IsSpace(B) && !IsDigit(C))
            {
                return true;
            }

            // Pattern: "1.2K" or "1,234" (digit + separator + digit)
            if (IsDigit(A) && IsSeparator(B) && IsDigit(C))
            {
                return true;
            }
        }

        return false;
    }

    function ParseShortsLikes(Text)
    {
        if (!Text)
        {
            return null;
        }

        for (var i = 0; i < Text.length; i++)
        {
            if (Text[i] === '\xa0')
            {
                return Infinity;
            }
        }

        var Num = Number(Text);
        return isNaN(Num) ? null : Num;
    }

    //------------------------------------------------------------------------------------------------------
    // Quality Checks
    //------------------------------------------------------------------------------------------------------

    function IsLowQualityVideo(ViewsText)
    {
        if (!ViewsText)
        {
            return false;
        }

        var Text = ViewsText.innerText;
        if (!Text || Text.length === 0)
        {
            return false;
        }

        Text = Text.trim();

        var HasViews = ContainsDigit(Text);
        var HasEnoughViews = HasLargeViewCount(Text); // because of different languages I made a simple method to detect >1000 views based on indirect signs
        var IsLowQuality = !HasViews || !HasEnoughViews;
        if (IsLowQuality)
        {
            Log("Low Quality Video", "ViewsText: \"" + Text + "\"");
        }

        return IsLowQuality;
    }

    function IsLowQualityShort(LikesText)
    {
        if (!LikesText)
        {
            return false;
        }

        var Text = LikesText.innerText;
        if (!Text || Text.length === 0)
        {
            return false;
        }

        Text = Text.trim();

        var Likes = ParseShortsLikes(Text);
        if (Likes === null)
        {
            return false;
        }

        var IsLowQuality = Likes < Config.MinShortsLikes;
        if (IsLowQuality)
        {
            Log("Low Quality Short", "LikesText: \"" + Text + "\"");
        }

        return IsLowQuality;
    }

    //------------------------------------------------------------------------------------------------------
    // Videos Filter
    //------------------------------------------------------------------------------------------------------

    function ProcessRightPanelVideo(Element)
    {
        if (!Element)
        {
            return;
        }

        // we are getting a strings from a video panel (row isn't needed, we know that string[2] is always a views count)
        var ViewsElements = Element.querySelectorAll(".yt-core-attributed-string");
        if (ViewsElements.length < 3)
        {
            return;
        }

        // we are getting a views text from a string[2]
        var ViewsText = ViewsElements[2];
        if (IsLowQualityVideo(ViewsText))
        {
            Element.remove();
        }
    }

    function ProcessMainPanelVideo(Element)
    {
        if (!Element)
        {
            return;
        }

        // skip if its a stack of videos, but not a single video (it's without a views information anyway)
        if (Element.querySelector(".ytCollectionsStackHost"))
        {
            return;
        }

        // we are getting a rows of video panel (we can't get just a strings, because it's on different positions)
        var MetadataRows = Element.querySelectorAll(".yt-content-metadata-view-model__metadata-row");
        if (MetadataRows.length < 2)
        {
            return;
        }

        // we are getting a strings of a row[1] (we know that row[1] always contains a string[0] as views count)
        var ViewsElements = MetadataRows[1].querySelectorAll(".yt-core-attributed-string");
        if (ViewsElements.length < 2)
        {
            return;
        }

        // we are getting a views text from a string[0]
        var ViewsText = ViewsElements[0];
        if (IsLowQualityVideo(ViewsText))
        {
            Element.remove();
        }
    }

    function RunVideosFilter()
    {
        if (!Config.EnableVideosFilter)
        {
            return;
        }

        if (IsShorts() || IsFeed())
        {
            return;
        }

        var VideoList = document.querySelectorAll(".lockup.yt-lockup-view-model--wrapper");
        for (var i = 0; i < VideoList.length; i++)
        {
            var Video = VideoList[i];

            var Parent = Video.parentElement;
            if (!Parent)
            {
                continue;
            }

            if (Parent.id === "contents") // means that it's a video from a right panel
            {
                ProcessRightPanelVideo(Video);
            }
            else if (Parent.id === "content") // means that it's a video from a main page
            {
                ProcessMainPanelVideo(Parent.parentElement);
            }
        }
    }

    //------------------------------------------------------------------------------------------------------
    // Shorts Filter
    //------------------------------------------------------------------------------------------------------

    function SkipToNextShort()
    {
        var NavButtons = document.querySelectorAll(".navigation-button.style-scope.ytd-shorts");
        if (NavButtons.length < 2)
        {
            return;
        }

        var ClickTarget = NavButtons[1].querySelector(".yt-spec-touch-feedback-shape__fill");
        if (ClickTarget)
        {
            ClickTarget.click();
        }
    }

    function RunShortsFilter()
    {
        if (!Config.EnableShortsFilter)
        {
            return;
        }

        if (!IsShorts() || IsFeed())
        {
            return;
        }

        var VideoList = document.querySelectorAll(".reel-video-in-sequence-new.style-scope.ytd-shorts");
        for (var i = 0; i < VideoList.length; i++)
        {
            var Video = VideoList[i];

            // skip if its first openned shorts
            if (i == 0)
            {
                continue;
            }

            // skip if its not a current active shorts
            if (!Video.querySelector("ytd-reel-video-renderer"))
            {
                continue;
            }

            var LikeButton = Video.querySelector(".ytLikeButtonViewModelHost");
            if (!LikeButton)
            {
                continue;
            }

            var LikesText = LikeButton.querySelector(".yt-core-attributed-string");
            if (IsLowQualityShort(LikesText))
            {
                SkipToNextShort();
            }
        }
    }

    //------------------------------------------------------------------------------------------------------
    // Ads Sign Remover (if you are tired of clicking on this sign million times instead of a video)
    //------------------------------------------------------------------------------------------------------

    var AdsStyleInjected = false;

    function RunAdsSignRemover()
    {
        if (!Config.EnableAdsSignRemover)
        {
            return;
        }

        if (AdsStyleInjected)
        {
            return;
        }

        if (IsShorts())
        {
            return;
        }

        var Style = document.createElement("style");
        Style.textContent = ".ytInlinePlayerControlsTopLeftControls { display: none !important; }";
        document.head.appendChild(Style);

        AdsStyleInjected = true;
    }

    //------------------------------------------------------------------------------------------------------
    // Event Listeners
    //------------------------------------------------------------------------------------------------------

    document.addEventListener("yt-navigate-finish", function ()
    {
        setTimeout(() => {
            RunVideosFilter();
            RunShortsFilter();
            RunAdsSignRemover();
        }, 600);
    });

    window.addEventListener("message", function ()
    {
        setTimeout(() => {
            RunVideosFilter();
        }, 200);
    });

    window.addEventListener("load", function ()
    {
        setTimeout(() => {
            RunVideosFilter();
        }, 200);
    });

    window.addEventListener("scrollend", function ()
    {
        setTimeout(() => {
            RunVideosFilter();
        }, 0);
    });

    window.addEventListener("click", function ()
    {
        setTimeout(() => {
            RunVideosFilter();
        }, 200);
    });
})();
