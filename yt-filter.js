// ==UserScript==
// @name         YouTube Low-Quality Videos/Shorts Filter + Ads Sign Remover
// @namespace    http://tampermonkey.net/
// @version      2.1.4
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

    function IsLowQualityVideo(ViewsElement)
    {
        if (!ViewsElement)
        {
            return false;
        }

        var Text = ViewsElement.innerText;
        if (!Text || Text.length === 0)
        {
            return false;
        }

        Text = Text.trim();

        var HasViews = ContainsDigit(Text);
        var HasEnoughViews = HasLargeViewCount(Text);
        var IsLowQuality = !HasViews || !HasEnoughViews;

        if (IsLowQuality)
        {
            Log("Low Quality Video", "ViewsElement: \"" + Text + "\"");
        }

        return IsLowQuality;
    }

    function IsLowQualityShort(LikesElement)
    {
        if (!LikesElement)
        {
            return false;
        }

        var Text = LikesElement.innerText;
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
            Log("Low Quality Short", "LikesElement: \"" + Text + "\"");
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

        var ViewsElements = Element.querySelectorAll(".yt-core-attributed-string");
        if (ViewsElements.length < 3)
        {
            return;
        }

        if (IsLowQualityVideo(ViewsElements[2]))
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

        if (Element.querySelector(".ytCollectionsStackHost"))
        {
            return;
        }

        var MetadataRows = Element.querySelectorAll(".yt-content-metadata-view-model__metadata-row");
        if (MetadataRows.length < 2)
        {
            return;
        }

        var ViewsElements = MetadataRows[1].querySelectorAll(".yt-core-attributed-string");
        if (ViewsElements.length < 2)
        {
            return;
        }

        if (IsLowQualityVideo(ViewsElements[0]))
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

            if (Parent.id === "contents")
            {
                ProcessRightPanelVideo(Video);
            }
            else if (Parent.id === "content")
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
            if (!Video.querySelector("ytd-reel-video-renderer"))
            {
                continue;
            }

            var LikeButton = Video.querySelector(".ytLikeButtonViewModelHost");
            if (!LikeButton)
            {
                continue;
            }

            var LikesElement = LikeButton.querySelector(".yt-core-attributed-string");
            if (IsLowQualityShort(LikesElement))
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
    // Main
    //------------------------------------------------------------------------------------------------------

    function RunAllFilters()
    {
        RunVideosFilter();
        RunShortsFilter();
        RunAdsSignRemover();
    }

    //------------------------------------------------------------------------------------------------------
    // Event Listeners
    //------------------------------------------------------------------------------------------------------

    document.addEventListener("yt-navigate-finish", function ()
    {
        setTimeout(RunAllFilters, 600);
    });

    window.addEventListener("message", function ()
    {
        setTimeout(RunAllFilters, 200);
    });

    window.addEventListener("load", function ()
    {
        setTimeout(RunAllFilters, 200);
    });

    window.addEventListener("scrollend", function ()
    {
        setTimeout(RunAllFilters, 0);
    });

    window.addEventListener("click", function ()
    {
        setTimeout(RunAllFilters, 200);
    });
})();