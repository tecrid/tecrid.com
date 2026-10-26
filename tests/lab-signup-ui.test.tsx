import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { RoleProvider } from "../app/role-context";
import { EmailSignInForm } from "../app/sign-in/sign-in-form";
import { IssuerApplicationPanel } from "../app/dashboard/issuer-application";
afterEach(()=>{cleanup();vi.unstubAllGlobals()});
it("starts lab signup with a domain-matched mailbox and one-time-link request",async()=>{
 const transport=vi.fn().mockResolvedValue(Response.json({error:"Use your work email"},{status:400}));vi.stubGlobal("fetch",transport);
 render(<RoleProvider initialRole="laboratory" signedIn={false} hasWorkspace={false}><EmailSignInForm returnTo="/dashboard/laboratory" ready hasError={false} initialRole="laboratory"/></RoleProvider>);
 fireEvent.change(screen.getByLabelText("Email"),{target:{value:"quality@synthetic.test"}});
 fireEvent.change(screen.getByLabelText(/Laboratory website/),{target:{value:"https://synthetic.test"}});
 fireEvent.submit(screen.getByRole("button",{name:/Email me/}).closest("form")!);
 await screen.findByRole("alert");
 expect(transport).toHaveBeenCalledOnce();
 expect(JSON.parse(transport.mock.calls[0][1].body)).toMatchObject({email:"quality@synthetic.test",role:"laboratory",laboratoryWebsite:"https://synthetic.test"});
 expect(screen.getByRole("alert").textContent).toBe("Use your work email");
});
it("keeps the laboratory signup evidence in one multipart form with four stages",()=>{
 const {container}=render(<IssuerApplicationPanel application={null} issuerStatus="pending" documents={[]} checks={[]} confirmedEmail="quality@synthetic.test"/>);
 const form=container.querySelector("form.issuer-application-form")!;
 expect(container.querySelectorAll("form")).toHaveLength(1);
 expect(form.getAttribute("enctype")).toBe("multipart/form-data");expect(form.querySelectorAll("fieldset")).toHaveLength(4);
 expect(form.querySelector<HTMLInputElement>('input[name="scopeDocument"]')!.required).toBe(true);
 expect(form.querySelector<HTMLInputElement>('input[name="contactEmail"]')!.value).toBe("quality@synthetic.test");
 expect(form.querySelector('select[name="accreditationStatus"]')).toBeNull();
 expect(form.querySelector('a[href="/dashboard"]')).toBeNull();
});
