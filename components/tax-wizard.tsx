"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { Building2, FileText, Calculator, CheckCircle2 } from "lucide-react"

interface TaxProfile {
  businessName: string
  businessType: string
  entityType: string
  deductions: string[]
}

interface TaxWizardProps {
  onComplete: (profile: TaxProfile) => void
}

export function TaxWizard({ onComplete }: TaxWizardProps) {
  const [currentStep, setCurrentStep] = useState(1)
  const [profile, setProfile] = useState<TaxProfile>({
    businessName: "",
    businessType: "gohighlevel-agency",
    entityType: "llc",
    deductions: [],
  })

  const ghlDeductions = [
    { id: "software", label: "GoHighLevel & Software Subscriptions", description: "100% deductible" },
    { id: "home-office", label: "Home Office Expenses", description: "Portion of rent/mortgage" },
    { id: "internet", label: "Internet & Phone", description: "Business use percentage" },
    { id: "advertising", label: "Advertising & Marketing", description: "Client ads, your marketing" },
    { id: "contractors", label: "Contractor Payments", description: "Track for 1099s" },
    { id: "meals", label: "Client Meals & Entertainment", description: "50% deductible" },
    { id: "education", label: "Courses & Professional Development", description: "100% deductible" },
    { id: "travel", label: "Business Travel", description: "Conferences, client visits" },
    { id: "california-taxes", label: "California LLC Fees & Taxes", description: "State-specific" },
  ]

  const hairStylistDeductions = [
    { id: "booth-rent", label: "Booth/Chair Rental", description: "100% deductible" },
    { id: "hair-products", label: "Hair Products & Supplies", description: "Shampoo, color, treatments" },
    { id: "styling-tools", label: "Styling Tools & Equipment", description: "Scissors, dryers, flat irons" },
    { id: "furniture", label: "Salon Furniture & Decor", description: "Chairs, mirrors, decorations" },
    { id: "continuing-education", label: "Cosmetology Education", description: "Classes, certifications, workshops" },
    { id: "license-fees", label: "Cosmetology License Fees", description: "California Board of Barbering renewals" },
    { id: "insurance", label: "Professional Liability Insurance", description: "Salon/stylist insurance" },
    { id: "laundry", label: "Laundry & Cleaning", description: "Towels, capes, smocks" },
    { id: "marketing", label: "Marketing & Advertising", description: "Social media ads, business cards" },
    { id: "software-booking", label: "Booking & Scheduling Software", description: "Square, Vagaro, Schedulicity" },
    { id: "clothing", label: "Professional Clothing", description: "Work attire, aprons" },
    { id: "vehicle", label: "Vehicle Expenses", description: "Mileage to/from salon, supply runs" },
    { id: "phone-internet", label: "Phone & Internet", description: "Business use percentage" },
    { id: "ca-taxes", label: "California Taxes & Fees", description: "LLC fees, sales tax permits" },
  ]

  const deductionCategories = profile.businessType === "hair-stylist" ? hairStylistDeductions : ghlDeductions

  const handleNext = () => {
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1)
    } else {
      onComplete(profile)
    }
  }

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const toggleDeduction = (id: string) => {
    setProfile((prev) => ({
      ...prev,
      deductions: prev.deductions.includes(id) ? prev.deductions.filter((d) => d !== id) : [...prev.deductions, id],
    }))
  }

  const steps = [
    { number: 1, title: "Business Info", icon: Building2 },
    { number: 2, title: "Business Structure", icon: FileText },
    { number: 3, title: "Deduction Categories", icon: Calculator },
    { number: 4, title: "Review & Complete", icon: CheckCircle2 },
  ]

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="mb-8">
        <h2 className="text-3xl font-bold mb-2">California Business Tax Setup</h2>
        <p className="text-muted-foreground">
          Configure your accounting system to minimize taxes for your California business
        </p>
      </div>

      <div className="flex justify-between mb-8">
        {steps.map((step) => {
          const Icon = step.icon
          return (
            <div key={step.number} className="flex flex-col items-center flex-1">
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 ${
                  currentStep >= step.number ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}
              >
                <Icon className="w-6 h-6" />
              </div>
              <span
                className={`text-sm font-medium ${
                  currentStep >= step.number ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {step.title}
              </span>
            </div>
          )
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{steps[currentStep - 1].title}</CardTitle>
          <CardDescription>
            Step {currentStep} of {steps.length}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {currentStep === 1 && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="businessName">Business Name</Label>
                <Input
                  id="businessName"
                  placeholder="Your Business Name"
                  value={profile.businessName}
                  onChange={(e) => setProfile({ ...profile, businessName: e.target.value })}
                />
              </div>
              <div>
                <Label>Business Type</Label>
                <RadioGroup
                  value={profile.businessType}
                  onValueChange={(value) => setProfile({ ...profile, businessType: value, deductions: [] })}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="gohighlevel-agency" id="ghl" />
                    <Label htmlFor="ghl" className="font-normal">
                      GoHighLevel Digital Marketing Agency
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="hair-stylist" id="hair-stylist" />
                    <Label htmlFor="hair-stylist" className="font-normal">
                      Hair Stylist / Salon Professional
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="freelancer" id="freelancer" />
                    <Label htmlFor="freelancer" className="font-normal">
                      Freelance Digital Marketer
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="consultant" id="consultant" />
                    <Label htmlFor="consultant" className="font-normal">
                      Marketing Consultant
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-4">
              <div>
                <Label>Entity Type</Label>
                <RadioGroup
                  value={profile.entityType}
                  onValueChange={(value) => setProfile({ ...profile, entityType: value })}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="llc" id="llc" />
                    <Label htmlFor="llc" className="font-normal">
                      LLC (Recommended for California)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="s-corp" id="s-corp" />
                    <Label htmlFor="s-corp" className="font-normal">
                      S-Corp (Tax savings if profit over $60k)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="sole-prop" id="sole-prop" />
                    <Label htmlFor="sole-prop" className="font-normal">
                      Sole Proprietorship
                    </Label>
                  </div>
                </RadioGroup>
              </div>
              <div className="bg-accent p-4 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  <strong>California LLC:</strong> $800 annual minimum franchise tax. Consider S-Corp election if your
                  net profit exceeds $60,000 to save on self-employment taxes.
                </p>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-4">
              <Label>Select deduction categories to track</Label>
              <div className="space-y-3">
                {deductionCategories.map((category) => (
                  <div key={category.id} className="flex items-start space-x-3 p-3 border rounded-lg">
                    <Checkbox
                      id={category.id}
                      checked={profile.deductions.includes(category.id)}
                      onCheckedChange={() => toggleDeduction(category.id)}
                    />
                    <div className="flex-1">
                      <Label htmlFor={category.id} className="font-medium cursor-pointer">
                        {category.label}
                      </Label>
                      <p className="text-sm text-muted-foreground">{category.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {currentStep === 4 && (
            <div className="space-y-4">
              <div className="bg-accent p-6 rounded-lg space-y-4">
                <div>
                  <Label className="text-muted-foreground">Business Name</Label>
                  <p className="font-medium">{profile.businessName || "Not set"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Business Type</Label>
                  <p className="font-medium">
                    {profile.businessType === "gohighlevel-agency" && "GoHighLevel Digital Marketing Agency"}
                    {profile.businessType === "hair-stylist" && "Hair Stylist / Salon Professional"}
                    {profile.businessType === "freelancer" && "Freelance Digital Marketer"}
                    {profile.businessType === "consultant" && "Marketing Consultant"}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Entity Type</Label>
                  <p className="font-medium">
                    {profile.entityType === "llc" && "LLC"}
                    {profile.entityType === "s-corp" && "S-Corp"}
                    {profile.entityType === "sole-prop" && "Sole Proprietorship"}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">
                    Tracking {profile.deductions.length} Deduction Categories
                  </Label>
                  <ul className="list-disc list-inside text-sm space-y-1 mt-2">
                    {profile.deductions.map((id) => {
                      const category = deductionCategories.find((c) => c.id === id)
                      return category ? <li key={id}>{category.label}</li> : null
                    })}
                  </ul>
                </div>
              </div>
              <div className="bg-primary/10 border border-primary/20 p-4 rounded-lg">
                <p className="text-sm">
                  <strong>Ready to minimize your taxes!</strong> Your accounting system is configured to track all
                  relevant deductions for your California business. Connect your accounts to start importing
                  transactions.
                </p>
              </div>
            </div>
          )}

          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={handleBack} disabled={currentStep === 1}>
              Back
            </Button>
            <Button onClick={handleNext}>{currentStep === 4 ? "Complete Setup" : "Next"}</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
