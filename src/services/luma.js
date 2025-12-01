const parentPageUrl = "https://api2.luma.com/discover/bootstrap-page";

async function fetchLumaEvents() {
  try { 
    const response = await fetch(parentPageUrl);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();

    if (!Array.isArray(data.places)) {
      console.error("ERROR: data.places is not an array:", data.places);
      return [];
    }

    const placeDetails = data.places
      .map(placeItem => ({
        discplaceApiId: placeItem.place?.api_id,
        eventCount: placeItem.event_count ?? 0,
      }))
      .filter(p => p.discplaceApiId);

    console.log("Fetched Local Events Data:", placeDetails);

    let eventApiIds = [];
    let filteredEvents = [];
 
    for (const place of placeDetails) {
      const localEventsUrl =
        `https://api2.luma.com/discover/get-paginated-events?discover_place_api_id=${place.discplaceApiId}&pagination_limit=${place.eventCount}`;

      const eventResponse = await fetch(localEventsUrl);

      if (!eventResponse.ok) {
        console.error(
          `Error fetching events for place ${place.discplaceApiId}:`,
          eventResponse.status
        );
        continue;
      }

      const eventJson = await eventResponse.json();

      if (!eventJson?.entries?.length) {
        console.log(`No events found for Place API ID ${place.discplaceApiId}`);
        continue;
      }

      const requiredEventApiIds = eventJson.entries.map(entry => entry.event.api_id);
      eventApiIds = eventApiIds.concat(requiredEventApiIds);
    }

    console.log("Consolidated Event API IDs:", eventApiIds);
 
    for (const id of eventApiIds) {
      const eventDetailUrl = `https://api2.luma.com/event/get?event_api_id=${id}`;
      const eventDetailResponse = await fetch(eventDetailUrl);

      if (!eventDetailResponse.ok) {
        console.error(`Error fetching event details for ${id}:`, eventDetailResponse.status);
        continue;
      }

      const details = await eventDetailResponse.json();
      console.log(`Event Details for API ID ${id} found`);
 
      const eventObj = details.event ?? {};
      const geo = eventObj.geo_address_info ?? {};
      const calendar = details.calendar ?? {};

      const eventParseDetails = {
        name: eventObj.name ?? "",
        description:
          details.description_mirror ??
          eventObj.description_mirror ??
          "",
      };

      if (JSON.stringify(eventParseDetails).toLowerCase().includes("ethereum")) {
        const eventData = {
          name: eventObj.name ?? "",
          start_at: eventObj.start_at ?? null,
          end_at: eventObj.end_at ?? null,
          location_type: eventObj.location_type ?? null,
          url: eventObj.url ? `https://luma.com/${eventObj.url}` : null,
          location: geo.city_state ?? null,
          country: geo.country ?? null,
          socials: calendar.twitter_handle ?? null,
        };

        console.log('Event with "ethereum" found:', eventData);
        filteredEvents.push(eventData);
      }
    }

    return filteredEvents;

  } catch (error) {
    console.error("There was a problem with the fetch operation:", error);
    return [];
  }
}

module.exports = { fetchLumaEvents };
