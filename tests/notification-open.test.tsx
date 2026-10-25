import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import { NotificationOpen } from "../app/dashboard/notification-open";
afterEach(()=>{cleanup();vi.unstubAllGlobals();window.history.replaceState({},"","/dashboard");});
it("acknowledges only an explicit push link and sends no result fields",async()=>{
 const fetcher=vi.fn().mockResolvedValue(new Response(null,{status:200}));vi.stubGlobal("fetch",fetcher);
 render(<NotificationOpen/>);expect(fetcher).not.toHaveBeenCalled();cleanup();
 window.history.replaceState({},"","/dashboard?notificationEvent=event-1&notificationChannel=channel-1");render(<NotificationOpen/>);
 await waitFor(()=>expect(fetcher).toHaveBeenCalledTimes(1));expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({eventId:"event-1",channelId:"channel-1"});
});
