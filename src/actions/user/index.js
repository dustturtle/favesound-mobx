import flow from 'lodash/fp/flow';
import map from 'lodash/fp/map';
import filter from 'lodash/fp/filter';
import { arrayOf, normalize } from 'normalizr';
import userSchema from '../../schemas/user';
import trackSchema from '../../schemas/track';
import * as trackTypes from '../../constants/trackTypes';
import * as actionTypes from '../../constants/actionTypes';
import * as requestTypes from '../../constants/requestTypes';
import * as paginateLinkTypes from '../../constants/paginateLinkTypes';
import { setRequestInProcess } from '../../actions/request';
import { setPaginateLink } from '../../actions/paginate';
import { mergeEntities } from '../../actions/entities';
import { isTrack, toIdAndType } from '../../services/track';
import { getLazyLoadingUsersUrl } from '../../services/api';
import userStore from '../../stores/userStore';

export const fetchFollowings = (user, nextHref, ignoreInProgress) => (dispatch, getState) => {
  const requestType = requestTypes.FOLLOWINGS;
  const url = getLazyLoadingUsersUrl(user, nextHref, 'followings?limit=20&offset=0');
  const requestInProcess = getState().request[requestType];

  if (requestInProcess && !ignoreInProgress) { return; }

  dispatch(setRequestInProcess(true, requestType));

  return fetch(url)
    .then(response => response.json())
    .then(data => {
      const normalized = normalize(data.collection, arrayOf(userSchema));
      dispatch(mergeEntities(normalized.entities));
      userStore.followings.push(normalized.result);
      dispatch(setPaginateLink(data.next_href, paginateLinkTypes.FOLLOWINGS));
      dispatch(setRequestInProcess(false, requestType));
    });
};

export function mergeActivities(activities) {
  return {
    type: actionTypes.MERGE_ACTIVITIES,
    activities
  };
}

function mergeTrackTypesTrack(tracks) {
  return {
    type: actionTypes.MERGE_TRACK_TYPES_TRACK,
    tracks
  };
}

function mergeTrackTypesRepost(reposts) {
  return {
    type: actionTypes.MERGE_TRACK_TYPES_REPOST,
    reposts
  };
}

export const fetchActivities = (user, nextHref) => (dispatch, getState) => {
  const requestType = requestTypes.ACTIVITIES;
  const url = getLazyLoadingUsersUrl(user, nextHref, 'activities?limit=20&offset=0');
  const requestInProcess = getState().request[requestType];

  if (requestInProcess) { return; }

  dispatch(setRequestInProcess(true, requestType));

  return fetch(url)
    .then(response => response.json())
    .then(data => {
      const typeMap = flow(
        filter(isTrack),
        map(toIdAndType)
      )(data.collection);

      dispatch(mergeTrackTypesTrack(filter((value) => value.type === trackTypes.TRACK, typeMap)));
      dispatch(mergeTrackTypesRepost(filter((value) => value.type === trackTypes.TRACK_REPOST, typeMap)));

      const activitiesMap = flow(
        filter(isTrack),
        map('origin')
      )(data.collection);

      const normalized = normalize(activitiesMap, arrayOf(trackSchema));
      dispatch(mergeEntities(normalized.entities));
      dispatch(mergeActivities(normalized.result));

      dispatch(setPaginateLink(data.next_href, paginateLinkTypes.ACTIVITIES));
      dispatch(setRequestInProcess(false, requestType));
    });
};

export function mergeFollowers(followers) {
  return {
    type: actionTypes.MERGE_FOLLOWERS,
    followers
  };
}

export const fetchFollowers = (user, nextHref) => (dispatch, getState) => {
  const requestType = requestTypes.FOLLOWERS;
  const url = getLazyLoadingUsersUrl(user, nextHref, 'followers?limit=20&offset=0');
  const requestInProcess = getState().request[requestType];

  if (requestInProcess) { return; }

  dispatch(setRequestInProcess(true, requestType));

  return fetch(url)
    .then(response => response.json())
    .then(data => {
      const normalized = normalize(data.collection, arrayOf(userSchema));
      dispatch(mergeEntities(normalized.entities));
      dispatch(mergeFollowers(normalized.result));
      dispatch(setPaginateLink(data.next_href, paginateLinkTypes.FOLLOWERS));
      dispatch(setRequestInProcess(false, requestType));
    });
};

export function mergeFavorites(favorites) {
  return {
    type: actionTypes.MERGE_FAVORITES,
    favorites
  };
}

export const fetchFavorites = (user, nextHref) => (dispatch, getState) => {
  const requestType = requestTypes.FAVORITES;
  const url = getLazyLoadingUsersUrl(user, nextHref, 'favorites?linked_partitioning=1&limit=20&offset=0');
  const requestInProcess = getState().request[requestType];

  if (requestInProcess) { return; }

  dispatch(setRequestInProcess(true, requestType));

  return fetch(url)
    .then(response => response.json())
    .then(data => {
      const normalized = normalize(data.collection, arrayOf(trackSchema));
      dispatch(mergeEntities(normalized.entities));
      dispatch(mergeFavorites(normalized.result));
      dispatch(setPaginateLink(data.next_href, paginateLinkTypes.FAVORITES));
      dispatch(setRequestInProcess(false, requestType));
    });
};

const fetchFavoritesOfFollowing = (user, nextHref) => (dispatch) => {
  // const requestType = requestTypes.FAVORITES;
  const url = getLazyLoadingUsersUrl(user, nextHref, 'favorites?linked_partitioning=1&limit=200&offset=0');
  // const requestInProcess = getState().request[requestType];

  return fetch(url)
    .then(response => response.json())
    .then(data => {
      const normalized = normalize(data.collection, arrayOf(trackSchema));
      dispatch(mergeEntities(normalized.entities));
    });
};

const fetchFavoritesOfFollowings = () => (dispatch, getState) => {
  const { followings } = getState().user;

  if (followings) {
    map((following) => {
      if (!getState().followings[following.id]) {
        dispatch(fetchFavoritesOfFollowing());
      }
    }, followings);
  }
};

export const fetchAllFollowingsWithFavorites = () => (dispatch, getState) => {
  const nextHref = getState().paginate[paginateLinkTypes.FOLLOWINGS];
  const modifiedNextHref = nextHref ? nextHref.replace("page_size=20", "page_size=199") : null;
  const ignoreInProgress = true;

  const promise = dispatch(fetchFollowings(null, modifiedNextHref, ignoreInProgress));

  promise.then(() => {
    dispatch(fetchFavoritesOfFollowings());

    if (getState().paginate[paginateLinkTypes.FOLLOWINGS]) {
      dispatch(fetchAllFollowingsWithFavorites());
    }
  });
};
