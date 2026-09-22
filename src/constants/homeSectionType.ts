// NOTE: This should be included in the OpenAPI spec ideally
// https://github.com/jellyfin/jellyfin/blob/1b4394199a2f9883cd601bdb8c9d66015397aa52/Jellyfin.Data/Enums/HomeSectionType.cs
export enum HomeSectionType {
    None = 'none',
    SmallLibraryTiles = 'smalllibrarytiles',
    LibraryButtons = 'librarybuttons',
    ActiveRecordings = 'activerecordings',
    Resume = 'resume',
    ResumeAudio = 'resumeaudio',
    LatestMedia = 'latestmedia',
    NextUp = 'nextup',
    LiveTv = 'livetv',
    ResumeBook = 'resumebook',
    MoviesByGenre = 'moviesbygenre',
    SeriesByGenre = 'seriesbygenre'
}

// NOTE: This needs to match the server defaults
// https://github.com/jellyfin/jellyfin/blob/1b4394199a2f9883cd601bdb8c9d66015397aa52/Jellyfin.Api/Controllers/DisplayPreferencesController.cs#L120
export const DEFAULT_SECTIONS: HomeSectionType[] = [
    HomeSectionType.SmallLibraryTiles,
    HomeSectionType.Resume,
    HomeSectionType.ResumeAudio,
    HomeSectionType.ResumeBook,
    HomeSectionType.LiveTv,
    HomeSectionType.NextUp,
    HomeSectionType.LatestMedia,
    HomeSectionType.None,
    HomeSectionType.None,
    HomeSectionType.None
];

// The layout used for the "Home" tab when the genre home screen is enforced.
// Movies and series get their own tabs (see the home route).
export const GENRE_SECTIONS: HomeSectionType[] = [
    HomeSectionType.SmallLibraryTiles,
    HomeSectionType.Resume,
    HomeSectionType.ResumeAudio,
    HomeSectionType.ResumeBook
];
